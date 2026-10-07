from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen

from ai_upchar_llm.inference.model_registry import (
    V16_BASE_MODEL,
    V16_MODEL_VERSION,
    ModelRegistryError,
    validate_v16_adapter_path,
)

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
        try:
            validate_v16_adapter_path(model_path)
        except ModelRegistryError as error:
            raise HTTPException(503, f"Model candidate rejected: {error}") from error
        payload = request
        upstream = os.environ.get("VLLM_BASE_URL", "http://127.0.0.1:8000/v1").rstrip("/")
        body = json.dumps({"model": V16_MODEL_VERSION, "messages": [{"role": "system", "content": "Return only the AI UPCHAR clinical reasoning JSON contract. Never diagnose, prescribe, or mutate state."}, {"role": "user", "content": build_prompt(payload)}], "temperature": 0, "max_tokens": 800}).encode()
        try:
            response = urlopen(Request(f"{upstream}/chat/completions", data=body, headers={"Content-Type": "application/json"}), timeout=30)
            completion = json.loads(response.read())["choices"][0]["message"]["content"]
            return validate_and_guard(json.loads(completion), payload["safety_state"])
        except Exception as error:
            raise HTTPException(502, f"Private model inference failed: {type(error).__name__}") from error

    return app


def vllm_command() -> list[str]:
    adapter_path = os.environ.get("MODEL_PATH")
    if not adapter_path:
        raise RuntimeError("MODEL_PATH must point to the verified V16 adapter")
    verified_adapter = validate_v16_adapter_path(adapter_path)
    base_model = os.environ.get("BASE_MODEL_PATH", V16_BASE_MODEL)
    return [
        "vllm",
        "serve",
        base_model,
        "--enable-lora",
        "--lora-modules",
        f"{V16_MODEL_VERSION}={verified_adapter}",
        "--host",
        "127.0.0.1",
        "--port",
        os.environ.get("VLLM_PORT", "8000"),
        "--max-model-len",
        os.environ.get("MAX_MODEL_LEN", "4096"),
        "--gpu-memory-utilization",
        os.environ.get("GPU_MEMORY_UTILIZATION", "0.90"),
        "--tensor-parallel-size",
        os.environ.get("TENSOR_PARALLEL_SIZE", "1"),
    ]
