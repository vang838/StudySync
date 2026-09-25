from io import BytesIO
from unittest import TestCase

from docx import Document
from pptx import Presentation

from src.application.document_parser import (
    DocumentParseError,
    DocumentParserRegistry,
    UnsupportedParserError,
)

from src.application.docs_upload import DOCX_MEDIA_TYPE, PDF_MEDIA_TYPE, PPTX_MEDIA_TYPE, TEXT_MEDIA_TYPE

# helper func
def create_test_pdf(text: str) -> BytesIO:
    escaped_text = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    stream = f"BT\n/F1 12 Tf\n72 720 Td\n({escaped_text}) Tj\nET\n".encode("latin-1")

    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"endstream",
    ]

    pdf = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = []

    for index, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{index} 0 obj\n".encode())
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode())
    pdf.extend(b"0000000000 65535 f \n")

    for offset in offsets:
        pdf.extend(f"{offset:010d} 00000 n \n".encode())

    pdf.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_offset}\n%%EOF\n".encode()
    )

    return BytesIO(bytes(pdf))

class TestDocumentParserRegistry(TestCase):
    def setUp(self):
        self.registry = DocumentParserRegistry()

    def test_text_parser(self):
        parser = self.registry.get(TEXT_MEDIA_TYPE)

        result = parser.parse(BytesIO(b"Operating systems manage processes."))

        self.assertEqual(result.media_type, TEXT_MEDIA_TYPE)
        self.assertEqual(len(result.segments), 1)
        self.assertEqual(result.segments[0].text, "Operating systems manage processes.")
        self.assertEqual(result.segments[0].source_label, "text:1")

    def test_docx_parser(self):
        fileobj = BytesIO()
        document = Document()
        document.add_paragraph("First paragraph")
        document.add_paragraph("Second paragraph")
        document.save(fileobj)
        fileobj.seek(0)

        parser = self.registry.get(DOCX_MEDIA_TYPE)
        result = parser.parse(fileobj)

        self.assertEqual(result.media_type, DOCX_MEDIA_TYPE)
        self.assertEqual(len(result.segments), 2)
        self.assertEqual(result.segments[0].text, "First paragraph")
        self.assertEqual(result.segments[1].source_label, "paragraph:2")

    def test_pptx_parser(self):
        fileobj = BytesIO()
        presentation = Presentation()
        slide = presentation.slides.add_slide(presentation.slide_layouts[5])
        textbox = slide.shapes.add_textbox(0, 0, 100, 100)
        textbox.text = "CPU Scheduling"
        presentation.save(fileobj)
        fileobj.seek(0)

        parser = self.registry.get(PPTX_MEDIA_TYPE)
        result = parser.parse(fileobj)

        self.assertEqual(result.media_type, PPTX_MEDIA_TYPE)
        self.assertEqual(len(result.segments), 1)
        self.assertIn("CPU Scheduling", result.segments[0].text)
        self.assertEqual(result.segments[0].source_label, "slide:1")

    def test_pdf_parser(self):
        parser = self.registry.get(PDF_MEDIA_TYPE)
        result = parser.parse(create_test_pdf("CPU Scheduling"))

        self.assertEqual(result.media_type, PDF_MEDIA_TYPE)
        self.assertEqual(len(result.segments), 1)
        self.assertIn("CPU Scheduling", result.segments[0].text)
        self.assertEqual(result.segments[0].source_index, 1)
        self.assertEqual(result.segments[0].source_label, "page:1")

    def test_unsupported_media_type(self):
        with self.assertRaises(UnsupportedParserError):
            self.registry.get("application/octet-stream")

    def test_parsers_raise_consistent_error_for_invalid_content(self):
        invalid_documents = [
            (PDF_MEDIA_TYPE, b"%PDF-1.4\ninvalid"),
            (DOCX_MEDIA_TYPE, b"invalid docx"),
            (PPTX_MEDIA_TYPE, b"invalid pptx"),
            (TEXT_MEDIA_TYPE, b"\xff\xfe\x00\x00"),
        ]

        for media_type, content in invalid_documents:
            with self.subTest(media_type=media_type):
                parser = self.registry.get(media_type)

                with self.assertRaises(DocumentParseError):
                    parser.parse(BytesIO(content))