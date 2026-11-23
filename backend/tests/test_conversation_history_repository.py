from unittest import TestCase
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.adapters.repositories.sqlalchemy_conversation_history import SQLAlchemyConversationHistoryAdapter
from src.db.base import Base
from src.db.chat_conversation_models import ChatConversationRecord, ChatConversationTurnRecord
from src.db.models import ChatThreadRecord, User
from src.ports.conversation_history import ConversationTurn


class TestConversationHistoryRepository(TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.repository = SQLAlchemyConversationHistoryAdapter(self.db)

        self.db.add_all([
            User(
                user_id=1,
                user_first_name="First",
                user_last_name="Student",
                user_email="first@example.com",
                password_hash="unused-test-hash",
            ),
            User(
                user_id=2,
                user_first_name="Second",
                user_last_name="Student",
                user_email="second@example.com",
                password_hash="unused-test-hash",
            ),
        ])
        self.db.flush()

        self.first_conversation_id = uuid4().hex
        self.second_conversation_id = uuid4().hex
        self.other_user_conversation_id = uuid4().hex

        self.db.add_all([
            ChatConversationRecord(
                conversation_id=self.first_conversation_id,
                user_id=1,
                course_id=None,
            ),
            ChatConversationRecord(
                conversation_id=self.second_conversation_id,
                user_id=1,
                course_id=None,
            ),
            ChatConversationRecord(
                conversation_id=self.other_user_conversation_id,
                user_id=2,
                course_id=None,
            ),
        ])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def add_turn(self, conversation_id: str, question: str, answer: str) -> None:
        thread = ChatThreadRecord(
            chat_id=uuid4().hex,
            course_id=None,
            question=question,
            answer=answer,
        )
        self.db.add(thread)
        self.db.flush()

        self.db.add(ChatConversationTurnRecord(
            conversation_id=conversation_id,
            chat_id=thread.chat_id,
        ))
        self.db.commit()

    def test_returns_turns_in_chronological_order(self):
        self.add_turn(self.first_conversation_id, "Pizza is my favorite food.", "Understood.")
        self.add_turn(self.first_conversation_id, "What is my favorite food?", "Pizza.")

        turns = self.repository.get_recent_turns(
            conversation_id=self.first_conversation_id,
            user_id=1,
        )

        self.assertEqual(turns, [
            ConversationTurn(question="Pizza is my favorite food.", answer="Understood."),
            ConversationTurn(question="What is my favorite food?", answer="Pizza."),
        ])

    def test_retrieves_only_the_most_recent_turns(self):
        for index in range(10):
            self.add_turn(
                self.first_conversation_id,
                f"Question {index}",
                f"Answer {index}",
            )

        turns = self.repository.get_recent_turns(
            conversation_id=self.first_conversation_id,
            user_id=1,
        )

        self.assertEqual(len(turns), 8)
        self.assertEqual(turns[0].question, "Question 2")
        self.assertEqual(turns[-1].question, "Question 9")

    def test_does_not_return_another_users_history(self):
        self.add_turn(
            self.first_conversation_id,
            "My private information",
            "Private response",
        )

        turns = self.repository.get_recent_turns(
            conversation_id=self.first_conversation_id,
            user_id=2,
        )

        self.assertEqual(turns, [])

    def test_does_not_mix_separate_conversations(self):
        self.add_turn(self.first_conversation_id, "First conversation", "First answer")
        self.add_turn(self.second_conversation_id, "Second conversation", "Second answer")

        turns = self.repository.get_recent_turns(
            conversation_id=self.first_conversation_id,
            user_id=1,
        )

        self.assertEqual(turns, [
            ConversationTurn(question="First conversation", answer="First answer"),
        ])

    def test_returns_empty_history_for_unknown_conversation(self):
        turns = self.repository.get_recent_turns(
            conversation_id=uuid4().hex,
            user_id=1,
        )

        self.assertEqual(turns, [])

    def test_rejects_invalid_history_limits(self):
        for limit in (0, -1, 9):
            with self.subTest(limit=limit):
                with self.assertRaises(ValueError):
                    self.repository.get_recent_turns(
                        conversation_id=self.first_conversation_id,
                        user_id=1,
                        limit=limit,
                    )
