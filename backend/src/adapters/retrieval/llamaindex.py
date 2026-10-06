from llama_index.core import QueryBundle
from llama_index.core.retrievers import BaseRetriever
from llama_index.core.schema import NodeWithScore, TextNode

from src.application.document_retrieval_service import DocumentRetrievalService

class LlamaIndexDocumentRetriever(BaseRetriever):
    """Expose studysync docs retrieval through llamaindex"""
    def __init__(self, retrieval_service: DocumentRetrievalService, *, course_id: str, document_ids: list[str] | None = None, top_k: int = 5) -> None:
        super().__init__()
        
        course_id = course_id.strip()
        if not course_id:
            raise ValueError("course_id must not be empty")

        if top_k <= 0:
            raise ValueError("top_k must be greater than zero")

        self._retrieval_service = retrieval_service
        self._course_id = course_id
        self._document_ids = (
            list(document_ids)
            if document_ids is not None
            else None
        )
        self._top_k = top_k
        
    def _retrieve(self, query_bundle: QueryBundle) -> list[NodeWithScore]:
        chunks = self._retrieval_service.retrieve(query=query_bundle.query_str, course_id=self._course_id, document_ids=self._document_ids, top_k=self._top_k,)

        return [
            NodeWithScore(node=TextNode(id_=chunk.chunk_id,text=chunk.text,metadata=dict(chunk.metadata)), score=chunk.score)
            for chunk in chunks
        ]