from src.application.uwm_catalog_sync_service import sync_uwm_catalog_courses
from src.core.config import settings
from src.db.session import get_session_factory


def main() -> None:
    with get_session_factory()() as session:
        result = sync_uwm_catalog_courses(
            session,
            base_url=settings.uwm_catalog_base_url.rstrip("/"),
            timeout_seconds=settings.uwm_catalog_timeout_seconds,
            max_subjects=settings.uwm_catalog_max_subjects,
        )

    print(
        "UWM catalog sync complete: "
        f"subjects={result.subject_count}, "
        f"courses_found={result.course_count_found}, "
        f"inserted={result.inserted_count}, "
        f"updated_professors={result.updated_professor_count}, "
        f"failed_subjects={result.failed_subject_count}"
    )

    if result.failed_subject_count:
        raise RuntimeError(f"UWM catalog sync failed for {result.failed_subject_count} subjects.")


if __name__ == "__main__":
    main()