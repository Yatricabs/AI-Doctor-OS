# E12 Part 2 Advanced Dataset Audit

Audit date: 2026-10-04

The staged E12 package is not eligible for training or evaluation in its
current form.

- Declared training rows: 200
- Declared held-out rows: 30
- Unique training conversations: 6
- Unique held-out conversations: 6
- Full train/held-out overlap: 6 conversations
- Message roles: user -> assistant
- Assistant content present: yes

The apparent volume is duplicated synthetic rows, and every held-out
conversation also occurs in training. A model trained on this package would
produce invalid validation metrics and could overfit the six templates.

Decision: quarantine E12 and do not consume GPU time. A replacement E12
dataset must contain independently authored, clinically reviewed examples with
zero train/held-out leakage before Part 2 training can begin.
