from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from src.application.uwm_catalog_sync_service import sync_uwm_catalog_courses
from src.core.config import settings
from src.db.base import Base
from src.db.models import ChatMessageRecord, ChatThreadRecord

_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine
    if _engine is None:
        if not settings.database_url:
            raise RuntimeError("DATABASE_URL must be set before starting the backend.")

        connect_args = {}
        if settings.database_url.startswith("sqlite"):
            connect_args = {"check_same_thread": False}
        elif settings.database_url.startswith("postgresql"):
            connect_args = {"connect_timeout": 5}

        _engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(bind=get_engine(), autoflush=False, autocommit=False, expire_on_commit=False)
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initializes the database by creating tables and seeding initial data."""
    from src.db.models import Course, ProfessorReview # Import Course model here for seeding

    # 1. Create all tables if they do not exist
    engine = get_engine()
    Base.metadata.create_all(bind=engine)

    # 1a. Lightweight schema evolution for local dev without migrations.
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "courses" in table_names:
        column_names = {column["name"] for column in inspector.get_columns("courses")}
        if "professor" not in column_names:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE courses ADD COLUMN professor VARCHAR(200)"))

    if "professor_reviews" in table_names:
        column_names = {column["name"] for column in inspector.get_columns("professor_reviews")}
        if "user_id" not in column_names:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE professor_reviews ADD COLUMN user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE"))
        with engine.begin() as conn:
            conn.execute(
                text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS "
                    "uq_professor_review_user_professor_course "
                    "ON professor_reviews (user_id, professor, course_id)"
                )
            )

    # 2. Seed initial data for the Course table
    SessionLocal = get_session_factory()
    with SessionLocal() as session:
        # Check if any courses exist to prevent double-seeding
        count = session.query(Course).count()
        if count == 0:
            print("Seeding initial course data...")
            courses_to_seed = [
                Course(
                    course_id="cs101",
                    title="Introduction to Computer Science",
                    description="Fundamentals of computing and problem-solving.",
                    professor="Dr. Evelyn Reed, Ph.D.",
                    subject="Computer Science",
                    year=2024
                ),
                Course(
                    course_id="ma205",
                    title="Advanced Calculus",
                    description="In-depth study of multivariable calculus.",
                    professor="Dr. Amina Patel, Ph.D.",
                    subject="Mathematics",
                    year=2023
                )
            ]
            session.add_all(courses_to_seed)
            session.commit()
            print(f"Successfully seeded {len(courses_to_seed)} courses.")
        else:
            # Backfill professor values for previously seeded rows.
            updated = 0
            defaults = {
                "cs101": "Dr. Evelyn Reed, Ph.D.",
                "ma205": "Dr. Amina Patel, Ph.D.",
            }
            for course_id, professor in defaults.items():
                row = session.query(Course).filter(Course.course_id == course_id).first()
                if row is not None and not row.professor:
                    row.professor = professor
                    updated += 1

            if updated > 0:
                session.commit()
                print(f"Updated professor data for {updated} existing courses.")
            else:
                print("Database already contains course records. Skipping seed data insertion.")

        # Seed initial professor review data
        review_count = session.query(ProfessorReview).count()

        if review_count == 0:
            print("Seeding initial professor review data...")
            reviews_to_seed = [
                ProfessorReview(
                    professor="Dr. Evelyn Reed, Ph.D.",
                    course_id="cs101",
                    user_id=None,
                    rating=5,
                    feedback="Explains concepts clearly and is very helpful during class.",
                ),
                ProfessorReview(
                    professor="Dr. Evelyn Reed, Ph.D.",
                    course_id="cs101",
                    user_id=None,
                    rating=4,
                    feedback="Good professor overall. The assignments can be challenging.",
                ),
                ProfessorReview(
                    professor="Dr. Amina Patel, Ph.D.",
                    course_id="ma205",
                    user_id=None,
                    rating=5,
                    feedback="Very knowledgeable and explains difficult topics well.",
                ),
            ]

            session.add_all(reviews_to_seed)
            session.commit()
            print(f"Successfully seeded {len(reviews_to_seed)} professor reviews.")

        if settings.uwm_catalog_sync_on_startup:
            try:
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
                    f"failed_subjects={result.failed_subject_count}"
                )
            except Exception as sync_error:
                print(f"UWM catalog sync failed: {type(sync_error).__name__}: {sync_error}")
