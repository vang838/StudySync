from unittest import TestCase

from src.application.document_chunker import DocumentChunker
from src.application.document_normalizer import NormalizedDocument, NormalizedSegment


class TestDocumentChunker(TestCase):
    def test_combines_adjacent_segments(self):
        document = NormalizedDocument(
            media_type="application/pdf",
            segments=[
                NormalizedSegment(text="one two three", source_index=1, source_label="page:1"),
                NormalizedSegment(text="four five six", source_index=2, source_label="page:2"),
            ],
            text="one two three\n\nfour five six",
            content_hash="a" * 64,
        )

        chunker = DocumentChunker(max_words=10, overlap_words=2)
        chunks = chunker.chunk(document)

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].text, "one two three four five six")
        self.assertEqual(chunks[0].source_start_label, "page:1")
        self.assertEqual(chunks[0].source_end_label, "page:2")

    def test_splits_large_document(self):
        document = self._document("one two three four five six seven eight nine ten")
        chunker = DocumentChunker(max_words=5, overlap_words=1)

        chunks = chunker.chunk(document)

        self.assertEqual(len(chunks), 3)
        self.assertEqual(chunks[0].text, "one two three four five")
        self.assertEqual(chunks[1].text, "five six seven eight nine")
        self.assertEqual(chunks[2].text, "nine ten")

    def test_preserves_chunk_provenance(self):
        document = NormalizedDocument(
            media_type="application/pdf",
            segments=[
                NormalizedSegment(text="one two three", source_index=4, source_label="page:4"),
                NormalizedSegment(text="four five six", source_index=5, source_label="page:5"),
            ],
            text="one two three\n\nfour five six",
            content_hash="a" * 64,
        )

        chunker = DocumentChunker(max_words=4, overlap_words=1)
        chunks = chunker.chunk(document)

        self.assertEqual(chunks[0].source_start_index, 4)
        self.assertEqual(chunks[0].source_end_index, 5)
        self.assertEqual(chunks[0].source_start_label, "page:4")
        self.assertEqual(chunks[0].source_end_label, "page:5")
    

    def test_ignores_empty_segments(self):
        document = NormalizedDocument(
            media_type="text/plain",
            segments=[
                NormalizedSegment(text="", source_index=1, source_label="text:1"),
                NormalizedSegment(text="StudySync document", source_index=2, source_label="text:2"),
            ],
            text="StudySync document",
            content_hash="a" * 64,
        )

        chunks = DocumentChunker(max_words=10, overlap_words=2).chunk(document)

        self.assertEqual(len(chunks), 1)
        self.assertEqual(chunks[0].text, "StudySync document")
        self.assertEqual(chunks[0].source_start_label, "text:2")

    def test_rejects_invalid_configuration(self):
        with self.assertRaises(ValueError):
            DocumentChunker(max_words=100, overlap_words=100)

    def _document(self, text: str) -> NormalizedDocument:
        return NormalizedDocument(
            media_type="text/plain",
            segments=[
                NormalizedSegment(
                    text=text,
                    source_index=1,
                    source_label="text:1",
                )
            ],
            text=text,
            content_hash="a" * 64,
        )