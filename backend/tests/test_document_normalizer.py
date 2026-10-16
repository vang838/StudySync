from unittest import TestCase

from src.application.document_normalizer import DocumentNormalizer
from src.application.document_parser import ExtractedDocument, ExtractedSegment


class TestDocumentNormalizer(TestCase):
    def setUp(self):
        self.normalizer = DocumentNormalizer()

    def test_normalizes_whitespace(self):
        document = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="  Operating   systems\tmanage processes.  ",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        result = self.normalizer.normalize(document)

        self.assertEqual(result.text, "Operating systems manage processes.")
        self.assertEqual(result.segments[0].text, "Operating systems manage processes.")

    def test_normalizes_line_endings_and_blank_lines(self):
        document = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="First\r\n\r\n\r\nSecond\rThird",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        result = self.normalizer.normalize(document)

        self.assertEqual(result.text, "First\n\nSecond\nThird")

    def test_preserves_source_provenance(self):
        document = ExtractedDocument(
            media_type="application/pdf",
            segments=[
                ExtractedSegment(
                    text="CPU Scheduling",
                    source_index=12,
                    source_label="page:12",
                )
            ],
        )

        result = self.normalizer.normalize(document)

        self.assertEqual(result.segments[0].source_index, 12)
        self.assertEqual(result.segments[0].source_label, "page:12")

    def test_content_hash_is_deterministic(self):
        first = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="Operating   systems",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        second = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="Operating systems",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        first_result = self.normalizer.normalize(first)
        second_result = self.normalizer.normalize(second)

        self.assertEqual(first_result.content_hash, second_result.content_hash)

    def test_preserves_case_and_punctuation(self):
        document = ExtractedDocument(
            media_type="text/plain",
            segments=[
                ExtractedSegment(
                    text="TCP != UDP; CPU = 100%.",
                    source_index=1,
                    source_label="text:1",
                )
            ],
        )

        result = self.normalizer.normalize(document)

        self.assertEqual(result.text, "TCP != UDP; CPU = 100%.")