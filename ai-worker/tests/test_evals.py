import asyncio
import json

from ai_worker.evals import citations_valid, parse_judgement, retrieval_hit, summarize, CaseResult
from ai_worker.rag import NO_RESULTS_ANSWER, Source
from ai_worker.runner import JobRunner
from ai_worker.vector_store import SearchHit

from .fakes import FakeApi, FakeProvider, FakeStore, Recorder, settings


def source(n, doc="d1", page=None):
    return Source(n=n, documentId=doc, filename=f"{doc}.pdf", page=page, text="…", score=0.8)


# ── deterministic checks ─────────────────────────────────────────────────────


def test_citations_must_point_at_existing_sources():
    assert citations_valid("Yes [1][2].", 2)
    assert not citations_valid("Yes [3].", 2)  # cites a source that doesn't exist
    assert not citations_valid("Yes, 14 days.", 2)  # grounded answer without any citation
    assert citations_valid(NO_RESULTS_ANSWER, 0)


def test_retrieval_hit_by_document_and_page():
    sources = [source(1, "d1", 1), source(2, "d2", 3)]
    assert retrieval_hit(sources, None, None) is None  # case doesn't say what to expect
    assert retrieval_hit(sources, "d2", None) is True
    assert retrieval_hit(sources, "d2", 3) is True
    assert retrieval_hit(sources, "d2", 1) is False
    assert retrieval_hit(sources, None, 1) is True


def test_judge_replies_are_clamped_and_malformed_ones_tolerated():
    j = parse_judgement('{"correctness": 1.7, "faithfulness": -1, "reasoning": "ok"}', None)
    assert (j.correctness, j.faithfulness) == (1.0, 0.0)
    broken = parse_judgement("not json", None)
    assert broken.correctness is None and "unreadable" in broken.reasoning


def test_summary_averages_only_scored_cases():
    def case(correct, faithful, hit):
        return CaseResult("q", "e", "a", [], correct, faithful, "", hit, True, 100)

    s = summarize([case(1.0, 1.0, True), case(0.5, None, None), case(None, None, False)])
    assert s.correctness == 0.75 and s.faithfulness == 1.0
    assert s.retrieval_hit_rate == 0.5 and s.retrieval_cases == 2
    assert s.judged == 2 and s.avg_latency_ms == 100


# ── the EVAL_RUN job ─────────────────────────────────────────────────────────


def eval_message():
    payload = {
        "name": "Baseline",
        "topK": 2,
        "documents": [{"id": "d1", "filename": "handbook.pdf"}],
        "cases": [
            {"question": "How long?", "expected": "14 days", "expectedDocumentId": "d1", "expectedPage": 2},
            {"question": "Lunch?", "expected": "Wednesdays"},
        ],
    }
    return json.dumps({"id": "e1", "type": "EVAL_RUN", "payload": json.dumps(payload), "submittedBy": "a@x"}).encode()


def test_eval_runs_every_case_through_rag_and_the_judge():
    hits = [SearchHit("d1", 1, 2, "Training within 14 days.", 0.9)]
    api, events = FakeApi(), Recorder()
    provider = FakeProvider(chunks=("14 days ", "[1]."))
    runner = JobRunner(settings(), api, provider, events, FakeStore(hits))

    assert asyncio.run(runner.handle(eval_message())) is True

    # answers are generated at temperature 0 and judged in JSON mode with the configured top-k
    assert all(call["temperature"] == 0 for call in provider.calls)
    assert len(provider.judged) == 2 and all(j["json_mode"] for j in provider.judged)

    result = api.finished[0][1]
    report = json.loads(result["report"])
    assert report["name"] == "Baseline" and report["topK"] == 2
    assert report["summary"]["cases"] == 2
    assert report["summary"]["correctness"] == 1.0 and report["summary"]["faithfulness"] == 0.5
    assert report["summary"]["retrievalHitRate"] == 1.0 and report["summary"]["retrievalCases"] == 1
    assert report["summary"]["citationValidity"] == 1.0
    first = report["cases"][0]
    assert first["answer"] == "14 days [1]." and first["retrievalHit"] is True
    assert first["sources"][0]["page"] == 2
    # usage = 2 answers (10 in / 3 out) + 2 judgements (20 in / 8 out)
    assert (result["usage"].input_tokens, result["usage"].output_tokens) == (60, 22)
    assert result["output"].startswith("2 cases · correctness 1.00")

    progress = "".join(e["delta"] for e in events.events)
    assert "Running 2 cases with top-k 2" in progress and "Case 2/2" in progress
