import re
import unicodedata
from dataclasses import dataclass
from hashlib import sha256

from src.application.document_parser import ExtractedDocument


@dataclass(frozen=True)
class NormalizedSegment:
    text: str
    source_index: int
    source_label: str


@dataclass(frozen=True)
class NormalizedDocument:
    media_type: str
    segments: list[NormalizedSegment]
    text: str
    content_hash: str


class DocumentNormalizer:
    def normalize(self, document: ExtractedDocument) -> NormalizedDocument:
        segments = [
            NormalizedSegment(
                text=self._normalize_text(segment.text),
                source_index=segment.source_index,
                source_label=segment.source_label,
            )
            for segment in document.segments
        ]

        normalized_text = "\n\n".join(segment.text for segment in segments if segment.text)
        content_hash = sha256(normalized_text.encode("utf-8")).hexdigest()

        return NormalizedDocument(
            media_type=document.media_type,
            segments=segments,
            text=normalized_text,
            content_hash=content_hash,
        )

    def _normalize_text(self, text: str) -> str:
        text = unicodedata.normalize("NFC", text)
        text = text.replace("\r\n", "\n").replace("\r", "\n")
        text = text.replace("\u00a0", " ")
        text = re.sub(r"[ \t]+", " ", text)

        lines = [line.strip() for line in text.split("\n")]
        text = "\n".join(lines)
        text = re.sub(r"\n{3,}", "\n\n", text)

        return text.strip()