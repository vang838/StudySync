from urllib.parse import urlparse

from src.schemas.retrieval import Evidence


class SourceQualityService:
    """Apply deterministic authority rules to normalized evidence."""

    def evaluate(self, evidence: Evidence) -> Evidence:
        if evidence.source.source_type == "internal":
            return evidence.model_copy(
                update={"authority": "course_material", "quality_score": 1.0}
            )

        hostname = (urlparse(evidence.source.url).hostname or "").lower()

        if hostname.endswith((".gov", ".edu")):
            authority = "government_or_education"
            quality_score = 0.9
        elif hostname.endswith(".org"):
            authority = "nonprofit"
            quality_score = 0.75
        else:
            authority = "general_web"
            quality_score = 0.6

        if not evidence.source.url.lower().startswith("https://"):
            quality_score = max(0.0, quality_score - 0.2)

        return evidence.model_copy(
            update={"authority": authority, "quality_score": quality_score}
        )

    def evaluate_all(self, evidence: list[Evidence]) -> list[Evidence]:
        return [self.evaluate(item) for item in evidence]
