from hashlib import sha256
from io import BytesIO
from unittest import TestCase
from zipfile import ZipFile

from src.application.docs_upload import (
    DOCX_MEDIA_TYPE,
    PDF_MEDIA_TYPE,
    DocumentTooLargeError,
    DocumentTypeMismatchError,
    DocumentUploadInspector,
    EmptyDocumentError,
    UnsupportedDocumentTypeError,
)


class TestDocumentUploadInspector(TestCase):
    def setUp(self):
        self.inspector = DocumentUploadInspector(max_size_bytes=1024 * 1024)

    def test_pdf_inspection(self):
        content = b"%PDF-1.7\nStudySync test document"
        fileobj = BytesIO(content)

        result = self.inspector.inspect(filename="lecture.pdf", declared_media_type=PDF_MEDIA_TYPE, fileobj=fileobj)

        self.assertEqual(result.detected_media_type, PDF_MEDIA_TYPE)
        self.assertEqual(result.file_size_bytes, len(content))
        self.assertEqual(result.file_hash, sha256(content).hexdigest())
        self.assertEqual(fileobj.tell(), 0)

    def test_docx_inspection(self):
        fileobj = BytesIO()

        with ZipFile(fileobj, "w") as archive:
            archive.writestr("[Content_Types].xml", "<Types />")
            archive.writestr("word/document.xml", "<document />")

        fileobj.seek(0)

        result = self.inspector.inspect(filename="notes.docx", declared_media_type=DOCX_MEDIA_TYPE, fileobj=fileobj)

        self.assertEqual(result.detected_media_type, DOCX_MEDIA_TYPE)

    def test_rejects_unsupported_extension(self):
        with self.assertRaises(UnsupportedDocumentTypeError):
            self.inspector.inspect(filename="archive.exe", declared_media_type="application/octet-stream", fileobj=BytesIO(b"test"))

    def test_rejects_extension_content_mismatch(self):
        with self.assertRaises(DocumentTypeMismatchError):
            self.inspector.inspect(filename="fake.pdf", declared_media_type=PDF_MEDIA_TYPE, fileobj=BytesIO(b"ordinary text"))

    def test_rejects_declared_media_type_mismatch(self):
        content = b"%PDF-1.7\nStudySync"

        with self.assertRaises(DocumentTypeMismatchError):
            self.inspector.inspect(filename="lecture.pdf", declared_media_type="text/plain", fileobj=BytesIO(content))

    def test_rejects_large_document(self):
        inspector = DocumentUploadInspector(max_size_bytes=4)

        with self.assertRaises(DocumentTooLargeError):
            inspector.inspect(filename="notes.txt", declared_media_type="text/plain", fileobj=BytesIO(b"12345"))

    def test_rejects_empty_document(self):
        with self.assertRaises(EmptyDocumentError):
            self.inspector.inspect(filename="notes.txt", declared_media_type="text/plain", fileobj=BytesIO())