# Part 2 Advanced Dataset Audit

Audit date: 2026-10-04. All staged Part 2 datasets E12-E24 were checked using
full message-content identity, not record IDs.

| Stage | Train | Unique train | Held-out | Unique held-out | Leakage |
|---|---:|---:|---:|---:|---:|
| E12 | 200 | 6 | 30 | 6 | 6 |
| E13 | 200 | 5 | 30 | 5 | 5 |
| E14 | 200 | 5 | 30 | 5 | 5 |
| E15 | 200 | 5 | 30 | 5 | 5 |
| E16 | 200 | 6 | 30 | 6 | 6 |
| E17 | 200 | 5 | 30 | 5 | 5 |
| E18 | 150 | 5 | 30 | 5 | 5 |
| E19 | 150 | 5 | 30 | 5 | 5 |
| E20 | 150 | 5 | 30 | 5 | 5 |
| E21 | 150 | 4 | 30 | 4 | 4 |
| E22 | 200 | 5 | 30 | 5 | 5 |
| E23 | 250 | 5 | 30 | 5 | 5 |
| E24 | 250 | 7 | 30 | 7 | 7 |

All stages have user-to-assistant structure and non-empty assistant content,
but none has an independent held-out set. The apparent row counts are repeated
templates. No Part 2 GPU training is authorized by evidence from these files.

Required correction: replace each stage with independently authored and
clinically reviewed examples, then rerun duplicate, leakage, PII, schema and
safety audits before training.
