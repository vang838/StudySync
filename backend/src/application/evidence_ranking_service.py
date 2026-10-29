from src.schemas.retrieval import Evidence


class EvidenceRankingService:
    """Merge ranked evidence lists using quality-aware reciprocal rank fusion."""

    def rank(self, evidence_groups: list[list[Evidence]], top_k: int = 5) -> list[Evidence]:
        if top_k <= 0:
            raise ValueError("top_k must be greater than zero")

        ranked: list[Evidence] = []

        for evidence_group in evidence_groups:
            for index, evidence in enumerate(evidence_group, start=1):
                rank_score = 1.0 / (60 + index)
                if evidence.quality_score is not None:
                    rank_score += evidence.quality_score / 1_000_000

                ranked.append(evidence.model_copy(update={"rank_score": rank_score}))

        ranked.sort(
            key=lambda evidence: evidence.rank_score or 0.0,
            reverse=True,
        )

        return ranked[:top_k]
