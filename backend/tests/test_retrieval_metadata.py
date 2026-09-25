from unittest import TestCase

from pydantic import ValidationError

from src.schemas.retrieval import ChunkRetrievalMetadata


class TestChunkRetrievalMetadata(TestCase):
    def test_vector_metadata_contains_retrieval_fields(self):
        metadata = ChunkRetrievalMetadata(
            document_id="doc123",
            version_id="ver123",
            chunk_id="chunk123",
            course_id="CS537",
            owner_ref="user123",
            chunk_index=4,
            page_start=12,
            page_end=13,
            section_title="CPU Scheduling",
        )

        self.assertEqual(
            metadata.to_vector_metadata(),
            {
                "document_id": "doc123",
                "version_id": "ver123",
                "chunk_id": "chunk123",
                "course_id": "CS537",
                "owner_ref": "user123",
                "chunk_index": 4,
                "page_start": 12,
                "page_end": 13,
                "section_title": "CPU Scheduling",
            },
        )

    def test_vector_metadata_excludes_missing_optional_fields(self):
        metadata = ChunkRetrievalMetadata(
            document_id="doc123",
            version_id="ver123",
            chunk_id="chunk123",
            course_id="CS537",
            chunk_index=0,
        )

        result = metadata.to_vector_metadata()

        self.assertNotIn("owner_ref", result)
        self.assertNotIn("page_start", result)
        self.assertNotIn("page_end", result)
        self.assertNotIn("section_title", result)

    def test_chunk_index_must_be_nonnegative(self):
        with self.assertRaises(ValidationError):
            ChunkRetrievalMetadata(
                document_id="doc123",
                version_id="ver123",
                chunk_id="chunk123",
                course_id="CS537",
                chunk_index=-1,
            )