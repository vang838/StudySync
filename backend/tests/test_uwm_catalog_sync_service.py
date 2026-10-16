import unittest
import urllib.parse
from unittest.mock import patch

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from src.application.uwm_catalog_sync_service import sync_uwm_catalog_courses
from src.db.base import Base
from src.db.models import Course


class _FakeResponse:
    def __init__(self, *, text: str = "", json_data: dict | None = None, status_code: int = 200):
        self.text = text
        self._json_data = json_data or {}
        self.status_code = status_code

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self) -> dict:
        return self._json_data


class _FakeClient:
    def __init__(self, pages_by_slug: dict[str, str], search_results_by_subject: dict[str, list[dict]]):
        self._pages_by_slug = pages_by_slug
        self._search_results_by_subject = search_results_by_subject

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def get(self, url: str, headers: dict | None = None) -> _FakeResponse:
        del headers
        for slug, html in self._pages_by_slug.items():
            if f"/courses/{slug}/" in url:
                return _FakeResponse(text=html)
        return _FakeResponse(status_code=404)

    def post(self, url: str, content: str, headers: dict | None = None) -> _FakeResponse:
        del content, headers
        subject = url.split("&subject=", 1)[1] if "&subject=" in url else ""
        subject = urllib.parse.unquote(subject)
        return _FakeResponse(json_data={"results": self._search_results_by_subject.get(subject, [])})


class TestUwmCatalogSyncService(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine(
            "sqlite+pysqlite://",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        Base.metadata.create_all(self.engine)

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_sync_backfills_missing_professor_without_overwriting_existing(self) -> None:
        index_html = '<a href="/courses/film/">Film</a><a href="/courses/math/">Math</a>'
        film_html = """
        <h1 class="page-title">Film (FILM)</h1>
        <div class="courseblock">
          <p class="courseblocktitle"><strong>FILM 220 16mm Filmmaking</strong></p>
          <p class="courseblockextra noindent">3 cr.</p>
          <p class="courseblockdesc noindent">Post-foundation studio.</p>
        </div></div>
        """
        math_html = """
        <h1 class="page-title">Mathematics (MATH)</h1>
        <div class="courseblock">
          <p class="courseblocktitle"><strong>MATH 101 College Algebra</strong></p>
          <p class="courseblockextra noindent">3 cr.</p>
          <p class="courseblockdesc noindent">Algebra topics.</p>
        </div></div>
        <div class="courseblock">
          <p class="courseblocktitle"><strong>MATH 150 Trigonometry</strong></p>
          <p class="courseblockextra noindent">3 cr.</p>
          <p class="courseblockdesc noindent">Trig topics.</p>
        </div></div>
        """

        with Session(self.engine) as db:
            db.add(
                Course(
                    course_id="FILM 220",
                    title="Old Title",
                    description="Old desc",
                    professor=None,
                    subject="FILM",
                    year=2025,
                )
            )
            db.add(
                Course(
                    course_id="MATH 101",
                    title="Existing Algebra",
                    description="Existing desc",
                    professor="Dr. Existing",
                    subject="MATH",
                    year=2025,
                )
            )
            db.commit()

        fake_client = _FakeClient(
            pages_by_slug={"film": film_html, "math": math_html},
            search_results_by_subject={
                "FILM": [
                    {"code": "FILM 220", "instr": "Staff"},
                    {"code": "FILM 220", "instr": "S. Drake"},
                    {"code": "FILM 220", "instr": "S. Drake"},
                ],
                "MATH": [
                    {"code": "MATH 101", "instr": "Dr. Replacement"},
                    {"code": "MATH 150", "instr": "TBA"},
                ],
            },
        )

        with patch("src.application.uwm_catalog_sync_service.httpx.get", return_value=_FakeResponse(text=index_html)):
            with patch("src.application.uwm_catalog_sync_service.httpx.Client", return_value=fake_client):
                with Session(self.engine) as db:
                    result = sync_uwm_catalog_courses(
                        db,
                        base_url="https://catalog.uwm.edu",
                        timeout_seconds=10.0,
                    )

        self.assertEqual(result.inserted_count, 1)
        self.assertEqual(result.updated_professor_count, 1)

        with Session(self.engine) as db:
            by_id = {course.course_id: course for course in db.scalars(select(Course)).all()}
            self.assertEqual(by_id["FILM 220"].professor, "S. Drake")
            self.assertEqual(by_id["MATH 101"].professor, "Dr. Existing")
            self.assertIsNone(by_id["MATH 150"].professor)


if __name__ == "__main__":
    unittest.main()
