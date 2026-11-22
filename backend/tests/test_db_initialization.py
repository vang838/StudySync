import unittest
from unittest.mock import patch

from src.core.config import settings
from src.db.session import init_db

class TestDatabaseInitialization(unittest.TestCase):
    def test_schema_initialization_depends_on_environment(self) -> None:
        for environment, expected in (
            ("development", True),
            ("production", False),
            ("staging", False),
            ("unexpected", False),
        ):
            with self.subTest(environment=environment):
                with (
                    patch.object(settings, "app_env", environment),
                    patch.object(settings, "uwm_catalog_sync_on_startup", False),
                    patch("src.db.session._initialize_development_schema") as schema,
                    patch("src.db.session.get_session_factory") as session_factory,
                ):
                    db = session_factory.return_value.return_value.__enter__.return_value
                    db.query.return_value.count.return_value = 1
                    db.query.return_value.filter.return_value.first.return_value = None

                    init_db()

                    self.assertEqual(schema.call_count, int(expected))


if __name__ == "__main__":
    unittest.main()