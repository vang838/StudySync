import json
from unittest import TestCase
from unittest.mock import Mock

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from src.application.assistant_service import AssistantService
from src.application.document_retrieval_service import DocumentRetrievalService
from src.application.evidence_ranking_service import EvidenceRankingService
from src.application.evidence_retrieval_service import EvidenceRetrievalService
from src.application.evidence_service import EvidenceService
from src.application.rag_service import RAGService
from src.db.base import Base
from src.db.models import DocumentChunkRecord, DocumentRecord, DocumentVersionRecord, IngestionJobRecord
from src.ports.embedding import EmbeddingPort
from src.ports.external_retrieval import ExternalRetrievalPort
from src.ports.llm import LLMPort
from src.ports.vector_store import VectorSearchResult, VectorStorePort


class TestDocumentQuestionPipeline(TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite+pysqlite:///:memory:")
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.embedding = Mock(spec=EmbeddingPort)
        self.embedding.embed_query.return_value = [0.1, 0.2]
        self.vector_store = Mock(spec=VectorStorePort)
        self.external = Mock(spec=ExternalRetrievalPort)

        for document_id, course_id, filename in [
            ("target", "COMPSCI 595", "Hello_595.pdf"),
            ("other-file", "COMPSCI 595", "Other.pdf"),
            ("spaced-file", "COMPSCI 595", "Lecture notes (week 1).pdf"),
            ("short-name", "COMPSCI 595", "a.pdf"),
            ("long-name", "COMPSCI 595", "data.pdf"),
            ("other-course", "COMPSCI 101", "Hello_595.pdf"),
        ]:
            self.db.add(DocumentRecord(document_id=document_id, course_id=course_id, title=filename))
            self.db.add(DocumentVersionRecord(
                version_id=f"version-{document_id}", document_id=document_id, version_number=1,
                original_filename=filename, file_size_bytes=100, file_hash=document_id,
                object_key=f"documents/{document_id}.pdf", detected_media_type="application/pdf",
            ))
        self.db.add(IngestionJobRecord(job_id="job-1", version_id="version-target", status="ready"))
        self.db.add(DocumentChunkRecord(
            chunk_id="chunk-1", job_id="job-1", chunk_index=0,
            text="CS 595 is a capstone course about project management and software development.",
        ))
        self.db.commit()
        self.vector_store.search.return_value = [VectorSearchResult(
            record_id="chunk-1", score=0.9,
            metadata={
                "document_id": "target", "version_id": "version-target", "chunk_id": "chunk-1",
                "course_id": "COMPSCI 595", "chunk_index": 0, "page_start": 1,
            },
        )]
        self.documents = DocumentRetrievalService(self.db, self.embedding, self.vector_store)
        self.retrieval = EvidenceRetrievalService(
            self.documents, self.external, EvidenceService(), EvidenceRankingService(),
        )

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def test_named_file_filters_by_filename_and_course_and_retains_provenance(self):
        evidence = self.retrieval.retrieve(query="The hello_595.pdf talks about what?", course_id="COMPSCI 595")

        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0].source.metadata.original_filename, "Hello_595.pdf")
        self.external.search.assert_not_called()
        filters = self.vector_store.search.call_args.kwargs["metadata_filter"]
        self.assertEqual(filters, {"$and": [
            {"course_id": {"$eq": "COMPSCI 595"}}, {"document_id": {"$in": ["target"]}},
        ]})

    def test_unknown_filename_returns_no_evidence_without_web_fallback(self):
        evidence = self.retrieval.retrieve(query="Summarize missing.pdf", course_id="COMPSCI 595")

        self.assertEqual(evidence, [])
        self.external.search.assert_not_called()
        self.embedding.embed_query.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_spoken_pdf_name_resolves_to_the_uploaded_file(self):
        evidence = self.retrieval.retrieve(query="What does the hello_595 pdf contain?", course_id="COMPSCI 595")

        self.assertEqual(len(evidence), 1)
        self.assertEqual(evidence[0].source.metadata.original_filename, "Hello_595.pdf")
        self.external.search.assert_not_called()
        filters = self.vector_store.search.call_args.kwargs["metadata_filter"]
        self.assertEqual(filters["$and"][1], {"document_id": {"$in": ["target"]}})

    def test_unknown_spoken_pdf_name_does_not_select_other_documents(self):
        evidence = self.retrieval.retrieve(query="What does the missing pdf contain?", course_id="COMPSCI 595")

        self.assertEqual(evidence, [])
        self.external.search.assert_not_called()
        self.vector_store.search.assert_not_called()

    def test_named_file_with_spaces_and_parentheses_is_resolved(self):
        self.vector_store.search.return_value = []

        self.documents.retrieve(query="Summarize Lecture notes (week 1).pdf", course_id="COMPSCI 595")

        filters = self.vector_store.search.call_args.kwargs["metadata_filter"]
        self.assertEqual(filters["$and"][1], {"document_id": {"$in": ["spaced-file"]}})

    def test_shorter_filename_embedded_in_another_name_is_not_selected(self):
        self.vector_store.search.return_value = []

        self.documents.retrieve(query="Summarize data.pdf.", course_id="COMPSCI 595")

        filters = self.vector_store.search.call_args.kwargs["metadata_filter"]
        self.assertEqual(filters["$and"][1], {"document_id": {"$in": ["long-name"]}})

    def test_spoken_extension_preserves_filename_boundaries(self):
        self.vector_store.search.return_value = []

        self.documents.retrieve(query="Summarize data pdf.", course_id="COMPSCI 595")

        filters = self.vector_store.search.call_args.kwargs["metadata_filter"]
        self.assertEqual(filters["$and"][1], {"document_id": {"$in": ["long-name"]}})

    def test_uploaded_file_phrases_do_not_search_the_web(self):
        for question in ["What does the file I uploaded cover?", "Summarize my PDF."]:
            with self.subTest(question=question):
                evidence = self.retrieval.retrieve(query=question, course_id="COMPSCI 595")

                self.assertEqual(len(evidence), 1)
                self.assertEqual(evidence[0].source.source_type, "internal")
                self.external.search.assert_not_called()

    def test_filename_does_not_override_explicit_document_scope(self):
        evidence = self.retrieval.retrieve(
            query="Summarize Hello_595.pdf", course_id="COMPSCI 595", document_ids=["other-file"],
        )

        self.assertEqual(evidence, [])
        self.vector_store.search.assert_not_called()

    def test_exact_reported_question_reaches_generation_with_internal_citations(self):
        llm = Mock(spec=LLMPort)
        llm.generate.return_value = json.dumps({"claims": [{
            "text": "CS 595 covers project management and software development.",
            "evidence": [{"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95}],
        }]})
        assistant = AssistantService(llm, RAGService(self.retrieval, llm))

        result = assistant.generate(question="The hello_595.pdf talks about what?", course_id="COMPSCI 595")

        self.assertEqual(result.mode, "course")
        self.assertEqual(result.evidence_status, "sufficient")
        self.assertEqual(result.citations[0].document_id, "target")
        self.assertEqual(result.citations[0].original_filename, "Hello_595.pdf")
        self.external.search.assert_not_called()
        llm.generate.assert_called_once()
        self.assertIn("Hello_595.pdf", llm.generate.call_args.args[0])
        self.assertIn("claims", llm.generate.call_args.kwargs["response_schema"]["properties"])
        schema = llm.generate.call_args.kwargs["response_schema"]
        self.assertEqual(schema["$defs"]["_ProposedAssociation"]["properties"]["evidence_id"]["enum"], ["internal:chunk-1"])

    def test_echoed_question_cannot_be_returned_as_a_supported_answer(self):
        question = "The hello_595.pdf talks about what?"
        llm = Mock(spec=LLMPort)
        llm.generate.return_value = json.dumps({"claims": [{
            "text": question,
            "evidence": [{"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95}],
        }]})
        assistant = AssistantService(llm, RAGService(self.retrieval, llm))

        result = assistant.generate(question=question, course_id="COMPSCI 595")

        self.assertEqual(result.evidence_status, "insufficient")
        self.assertEqual(result.claims, [])
        self.assertEqual(result.citations, [])
        self.assertNotEqual(result.answer, question)

    def test_echoed_question_does_not_discard_supported_factual_claims(self):
        question = "The hello_595.pdf talks about what?"
        llm = Mock(spec=LLMPort)
        llm.generate.return_value = json.dumps({"claims": [
            {"text": question, "evidence": []},
            {"text": "CS 595 is a capstone course.", "evidence": [
                {"evidence_id": "internal:chunk-1", "relationship": "supports", "confidence": 0.95},
            ]},
        ]})
        assistant = AssistantService(llm, RAGService(self.retrieval, llm))

        result = assistant.generate(question=question, course_id="COMPSCI 595")

        self.assertEqual(result.evidence_status, "sufficient")
        self.assertEqual(result.answer, "CS 595 is a capstone course.")
        self.assertEqual(result.citations[0].claim_ids, ["claim-1"])
