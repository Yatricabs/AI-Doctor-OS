import json
from pathlib import Path


class SmokeAdapter:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self.manifest = json.loads((self.path / "adapter_config.json").read_text(encoding="utf-8"))
        if self.manifest.get("artifact_type") != "CONTRACT_SMOKE_ADAPTER":
            raise ValueError("Not an AI UPCHAR smoke adapter")

    def generate(self, request: dict) -> dict:
        text = str(request.get("current_answer", "")).lower()
        safety = any(
            term in text
            for term in ("chest pressure", "saans lene me dikkat", "breathing difficulty", "बेहोश")
        )
        semantic = {
            "patient_statement": request.get("current_answer", ""),
            "confirmed_diagnosis": None,
        }
        if "urine" in text and "burning" in text:
            semantic.update(
                {
                    "symptom": "burning urination",
                    "temporal_facts": ["since yesterday"] if "kal se" in text else [],
                }
            )
        if "kidney infection" in text:
            semantic["patient_reported_diagnosis"] = "kidney infection"
        return {
            "semantic_interpretation": semantic,
            "clinical_considerations": [],
            "recommended_action": "SAFETY_REVIEW" if safety else "ASK_QUESTION",
            "next_best_question": "Kya koi aur warning sign ya associated symptom bhi hai?",
            "missing_information": ["associated symptoms"],
            "confidence": None,
            "smoke_backend": True,
        }


def load_transformers_model(model_path: str):
    from transformers import AutoModelForCausalLM, AutoTokenizer

    return AutoModelForCausalLM.from_pretrained(
        model_path, device_map="auto"
    ), AutoTokenizer.from_pretrained(model_path)
