from unittest.mock import Mock

import pytest

from src.application.evidence_retrieval_service import EvidenceRetrievalService

@pytest.mark.parametrize(
    ("source_scope", "uses_documents", "uses_external"),
    [
        ("documents", True, False),
        ("external", False, True),
        ("both", True, True),
    ],
)
def test_retrieve_respects_source_scope(source_scope: str, uses_documents: bool, uses_external: bool) -> None:
    document_retrieval = Mock()
    document_retrieval.retrieve.return_value = []

    external_retrieval = Mock()
    external_retrieval.search.return_value = []

    ranking_service = Mock()
    ranking_service.rank.return_value = []

    quality_service = Mock()
    quality_service.evaluate_all.return_value = []

    service = EvidenceRetrievalService(
        document_retrieval=document_retrieval,
        external_retrieval=external_retrieval,
        evidence_service=Mock(),
        ranking_service=ranking_service,
        quality_service=quality_service,
    )

    result = service.retrieve(query="Explain mutex locks", course_id="CS537", user_id=1, source_scope=source_scope)

    assert result == []

    if uses_documents:
        document_retrieval.retrieve.assert_called_once_with(
            query="Explain mutex locks",
            course_id="CS537",
            user_id=1,
            document_ids=None,
            top_k=5,
        )
    else:
        document_retrieval.retrieve.assert_not_called()

    if uses_external:
        external_retrieval.search.assert_called_once_with("Explain mutex locks", top_k=5)
    else:
        external_retrieval.search.assert_not_called()