from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen

REQUIRED_INPUT = {"patient_context", "current_answer", "semantic_context", "safety_state", "retrieved_evidence"}


def validate_request(payload: dict) -> None:
    missing = REQUIRED_INPUT - set(payload)
    if missing:
        raise ValueError(f"Missing request fields: {sorted(missing)}")


def create_app():
    from fastapi import FastAPI, HTTPException
    from ai_upchar_llm.inference.generate import build_prompt, validate_and_guard

    app = FastAPI(title="AI UPCHAR Clinical Reasoning Gateway", version="0.1.0")
    model_path = os.environ.get("MODEL_PATH")

    @app.get("/health")
    def health():
        return {"status": "ok", "model_path_configured": bool(model_path)}

    @app.post("/v1/clinical/reason")
    def reason(request: dict):
        try:
            validate_request(request)
        except ValueError as error:
            raise HTTPException(422, str(error)) from error
        if not model_path:
            raise HTTPException(503, "MODEL_PATH is not configured")
        payload = request
        upstream = os.environ.get("VLLM_BASE_URL", "http://127.0.0.1:8000/v1").rstrip("/")
        body = json.dumps({"model": model_path, "messages": [{"role": "system", "content": "Return only the AI UPCHAR clinical reasoning JSON contract. Never diagnose, prescribe, or mutate state."}, {"role": "user", "content": build_prompt(payload)}], "temperature": 0, "max_tokens": 800}).encode()
        try:
            response = urlopen(Request(f"{upstream}/chat/completions", data=body, headers={"Content-Type": "application/json"}), timeout=30)
            completion = json.loads(response.read())["choices"][0]["message"]["content"]
            return validate_and_guard(json.loads(completion), payload["safety_state"])
        except Exception as error:
            raise HTTPException(502, f"Private model inference failed: {type(error).__name__}") from error

    return app


def vllm_command() -> list[str]:
    return ["vllm", "serve", os.environ.get("MODEL_PATH", "Qwen/Qwen3-8B-Base"), "--host", "127.0.0.1", "--port", os.environ.get("VLLM_PORT", "8000"), "--max-model-len", os.environ.get("MAX_MODEL_LEN", "4096"), "--gpu-memory-utilization", os.environ.get("GPU_MEMORY_UTILIZATION", "0.90"), "--tensor-parallel-size", os.environ.get("TENSOR_PARALLEL_SIZE", "1")]
