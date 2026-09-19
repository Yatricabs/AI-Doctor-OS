# Training plan

1. Approve and version a licensed corpus; publish corpus/token/source reports.
2. Run optional continued pretraining with checkpoints and held-out perplexity.
3. Run conversational QLoRA SFT with assistant-only loss where templates permit.
4. Evaluate semantic, multilingual, safety, adaptive-question, and hallucination
   gates against the previous model.
5. Record model version, base model, dataset/config/eval versions, code commit,
   date, method, adapter status, GPU topology, tokens, duration, and scores in
   JSON/CSV experiment manifests.
6. Consider DPO only after reviewed preference data exists.

No large training is part of milestone 1.
