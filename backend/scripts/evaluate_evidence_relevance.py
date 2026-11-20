import json
from pathlib import Path
from time import perf_counter

from src.api.dependencies import get_llm_port
from src.application.evidence_relevance_service import EvidenceRelevanceService
from src.schemas.retrieval import Evidence


FIXTURE_PATH = Path(__file__).resolve().parents[1] / "tests/fixtures/evidence_relevance_cases.json"


def evaluate() -> None:
    cases = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))
    llm_provider = get_llm_port()
    llm = next(llm_provider)

    try:
        service = EvidenceRelevanceService(llm)
        true_positive = false_positive = false_negative = 0
        total_passages = total_relevant = 0

        for case_index, case in enumerate(cases, start=1):
            evidence = [
                Evidence(
                    text=passage["text"],
                    source={
                        "source_type": "internal",
                        "metadata": {
                            "document_id": f"eval-doc-{case_index}",
                            "version_id": "eval-version",
                            "chunk_id": f"eval-{case_index}-{index}",
                            "course_id": "EVAL",
                            "chunk_index": index,
                        },
                    },
                )
                for index, passage in enumerate(case["passages"])
            ]

            expected = {
                item.evidence_id
                for item, passage in zip(evidence, case["passages"], strict=True)
                if passage["relevant"]
            }

            started = perf_counter()
            selected = service.filter(question=case["question"], evidence=evidence)
            elapsed = perf_counter() - started
            predicted = {item.evidence_id for item in selected}

            tp = len(predicted & expected)
            fp = len(predicted - expected)
            fn = len(expected - predicted)

            true_positive += tp
            false_positive += fp
            false_negative += fn
            total_passages += len(evidence)
            total_relevant += len(expected)

            print(f"Case {case_index}: TP={tp} FP={fp} FN={fn} latency={elapsed:.2f}s")
            if fp or fn:
                print(f"  Incorrect IDs: {sorted(predicted ^ expected)}")

        precision = true_positive / (true_positive + false_positive) if true_positive + false_positive else 0.0
        recall = true_positive / (true_positive + false_negative) if true_positive + false_negative else 0.0
        baseline_precision = total_relevant / total_passages if total_passages else 0.0

        print(f"\nPrecision: {precision:.2%}")
        print(f"Recall: {recall:.2%}")
        print(f"Unfiltered precision baseline: {baseline_precision:.2%}")
        print("Unfiltered recall baseline: 100%")
    finally:
        llm_provider.close()


if __name__ == "__main__":
    evaluate()
