from dataclasses import dataclass
from hashlib import sha256
from pathlib import Path
from typing import BinaryIO
from zipfile import BadZipFile, ZipFile


PDF_MEDIA_TYPE = "application/pdf"
DOCX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
PPTX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"
TEXT_MEDIA_TYPE = "text/plain"

SUPPORTED_MEDIA_TYPES = {
    ".pdf": PDF_MEDIA_TYPE,
    ".docx": DOCX_MEDIA_TYPE,
    ".pptx": PPTX_MEDIA_TYPE,
    ".txt": TEXT_MEDIA_TYPE,
}


class DocumentUploadValidationError(Exception):
    pass


class UnsupportedDocumentTypeError(DocumentUploadValidationError):
    pass


class DocumentTypeMismatchError(DocumentUploadValidationError):
    pass


class DocumentTooLargeError(DocumentUploadValidationError):
    pass


class EmptyDocumentError(DocumentUploadValidationError):
    pass


@dataclass(frozen=True)
class DocumentUploadInspection:
    original_filename: str
    extension: str
    declared_media_type: str | None
    detected_media_type: str
    file_size_bytes: int
    file_hash: str


class DocumentUploadInspector:
    def __init__(self, max_size_bytes: int):
        self._max_size_bytes = max_size_bytes

    def inspect(self, *, filename: str, declared_media_type: str | None, fileobj: BinaryIO) -> DocumentUploadInspection:
        extension = Path(filename).suffix.lower()

        if extension not in SUPPORTED_MEDIA_TYPES:
            raise UnsupportedDocumentTypeError(f"Unsupported document extension: '{extension}'.")

        file_size_bytes, file_hash = self._measure_and_hash(fileobj)

        if file_size_bytes == 0:
            raise EmptyDocumentError("Uploaded document is empty.")

        detected_media_type = self._detect_media_type(fileobj)

        if detected_media_type is None:
            raise UnsupportedDocumentTypeError("Unable to determine the uploaded document type.")

        expected_media_type = SUPPORTED_MEDIA_TYPES[extension]

        if detected_media_type != expected_media_type:
            raise DocumentTypeMismatchError("Document content does not match its file extension.")

        normalized_declared_type = self._normalize_media_type(declared_media_type)

        if normalized_declared_type not in {None, expected_media_type, "application/octet-stream"}:
            raise DocumentTypeMismatchError("Declared media type does not match the uploaded document.")

        fileobj.seek(0)

        return DocumentUploadInspection(
            original_filename=filename,
            extension=extension,
            declared_media_type=normalized_declared_type,
            detected_media_type=detected_media_type,
            file_size_bytes=file_size_bytes,
            file_hash=file_hash,
        )

    def _measure_and_hash(self, fileobj: BinaryIO) -> tuple[int, str]:
        digest = sha256()
        total_bytes = 0

        fileobj.seek(0)

        while chunk := fileobj.read(1024 * 1024):
            total_bytes += len(chunk)

            if total_bytes > self._max_size_bytes:
                fileobj.seek(0)
                raise DocumentTooLargeError(f"Document exceeds the {self._max_size_bytes}-byte upload limit.")

            digest.update(chunk)

        fileobj.seek(0)
        return total_bytes, digest.hexdigest()

    def _detect_media_type(self, fileobj: BinaryIO) -> str | None:
        fileobj.seek(0)
        header = fileobj.read(8)
        fileobj.seek(0)

        if header.startswith(b"%PDF-"):
            return PDF_MEDIA_TYPE

        zip_media_type = self._detect_zip_media_type(fileobj)

        if zip_media_type is not None:
            return zip_media_type

        fileobj.seek(0)
        sample = fileobj.read(8192)
        fileobj.seek(0)

        if b"\x00" in sample:
            return None

        try:
            sample.decode("utf-8")
        except UnicodeDecodeError:
            return None

        return TEXT_MEDIA_TYPE

    def _detect_zip_media_type(self, fileobj: BinaryIO) -> str | None:
        fileobj.seek(0)

        try:
            with ZipFile(fileobj) as archive:
                names = set(archive.namelist())

                if "word/document.xml" in names:
                    return DOCX_MEDIA_TYPE

                if "ppt/presentation.xml" in names:
                    return PPTX_MEDIA_TYPE
        except BadZipFile:
            return None
        finally:
            fileobj.seek(0)

        return None

    @staticmethod
    def _normalize_media_type(media_type: str | None) -> str | None:
        if media_type is None:
            return None

        return media_type.split(";", 1)[0].strip().lower()