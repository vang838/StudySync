from dataclasses import dataclass

from src.application.document_normalizer import NormalizedDocument, NormalizedSegment


@dataclass(frozen=True)
class DocumentChunk:
    chunk_index: int
    text: str
    source_start_index: int
    source_end_index: int
    source_start_label: str
    source_end_label: str
    word_count: int


@dataclass(frozen=True)
class _ChunkWord:
    text: str
    source_index: int
    source_label: str


class DocumentChunker:
    def __init__(self, max_words: int = 300, overlap_words: int = 50):
        if max_words <= 0:
            raise ValueError("max_words must be greater than zero.")

        if overlap_words < 0:
            raise ValueError("overlap_words cannot be negative.")

        if overlap_words >= max_words:
            raise ValueError("overlap_words must be smaller than max_words.")

        self._max_words = max_words
        self._overlap_words = overlap_words

    def chunk(self, document: NormalizedDocument) -> list[DocumentChunk]:
        words = self._flatten_segments(document.segments)

        if not words:
            return []

        chunks = []
        start = 0
        chunk_index = 0

        while start < len(words):
            end = min(start + self._max_words, len(words))
            chunk_words = words[start:end]

            chunks.append(
                DocumentChunk(
                    chunk_index=chunk_index,
                    text=" ".join(word.text for word in chunk_words),
                    source_start_index=chunk_words[0].source_index,
                    source_end_index=chunk_words[-1].source_index,
                    source_start_label=chunk_words[0].source_label,
                    source_end_label=chunk_words[-1].source_label,
                    word_count=len(chunk_words),
                )
            )

            if end == len(words):
                break

            start = end - self._overlap_words
            chunk_index += 1

        return chunks

    def _flatten_segments(self, segments: list[NormalizedSegment]) -> list[_ChunkWord]:
        words = []

        for segment in segments:
            for word in segment.text.split():
                words.append(
                    _ChunkWord(
                        text=word,
                        source_index=segment.source_index,
                        source_label=segment.source_label,
                    )
                )

        return words