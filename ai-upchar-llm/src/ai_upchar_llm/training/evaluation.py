from ai_upchar_llm.evaluation.benchmark import load_benchmark, run_benchmark


def evaluate(path: str, generator) -> dict:
    return run_benchmark(load_benchmark(path), generator)
