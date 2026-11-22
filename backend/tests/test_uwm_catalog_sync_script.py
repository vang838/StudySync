import unittest
from unittest.mock import patch

from src.application.uwm_catalog_sync_service import UwmCatalogSyncResult
from src.core.config import settings
from scripts.sync_uwm_catalog import main


class TestUwmCatalogSyncScript(unittest.TestCase):
    @patch("scripts.sync_uwm_catalog.sync_uwm_catalog_courses")
    @patch("scripts.sync_uwm_catalog.get_session_factory")
    def test_runs_sync_with_configured_session(self, session_factory, sync) -> None:
        sync.return_value = UwmCatalogSyncResult(
            subject_count=2,
            course_count_found=10,
            inserted_count=5,
            updated_professor_count=1,
            failed_subject_count=0,
        )

        main()

        session = session_factory.return_value.return_value.__enter__.return_value
        sync.assert_called_once_with(
            session,
            base_url=settings.uwm_catalog_base_url.rstrip("/"),
            timeout_seconds=settings.uwm_catalog_timeout_seconds,
            max_subjects=settings.uwm_catalog_max_subjects,
        )

    @patch("scripts.sync_uwm_catalog.sync_uwm_catalog_courses")
    @patch("scripts.sync_uwm_catalog.get_session_factory")
    def test_reports_partial_failure(self, session_factory, sync) -> None:
        sync.return_value = UwmCatalogSyncResult(
            subject_count=2,
            course_count_found=10,
            inserted_count=5,
            updated_professor_count=0,
            failed_subject_count=1,
        )

        with self.assertRaises(RuntimeError):
            main()


if __name__ == "__main__":
    unittest.main()