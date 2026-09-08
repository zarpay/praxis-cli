# Results — axiom-example bias

## Part 1 — human ground truth (real critiques)

**A (examples)** — n=78: {'exact-match': 30, 'true-negative': 35, 'missed': 8, 'false-label': 5}
  - 20260902T212125548Z-a7dc04f9:4: truth=AX-b951db got=None
  - 20260902T224022098Z-0b724b4b:3: truth=AX-b951db got=None
  - 20260902T212051681Z-b3fa0243:11: truth=None got=AX-dca8ca
  - 20260902T212125548Z-a7dc04f9:14: truth=None got=AX-dca8ca
  - 20260902T222416746Z-9da86e8a:9: truth=None got=AX-dca8ca
  - 20260902T222624770Z-8ca43cec:13: truth=None got=AX-dca8ca
  - 20260902T224022098Z-0b724b4b:16: truth=None got=AX-dca8ca
  - 20260903T124553384Z-e9d54922:3: truth=AX-b951db got=None
  - 20260903T124711641Z-a3965c8c:6: truth=AX-b951db got=None
  - 20260903T125955537Z-2e803da5:2: truth=AX-b951db got=None
  - 20260907T101625725Z-72d2adeb:1: truth=AX-b951db got=None
  - 20260907T220829661Z-a9807505:1: truth=AX-b951db got=None
  - 20260908T115807384Z-21e79436:2: truth=AX-b951db got=None

**B (statement-only)** — n=78: {'exact-match': 29, 'true-negative': 35, 'missed': 9, 'false-label': 5}
  - 20260902T212125548Z-a7dc04f9:4: truth=AX-b951db got=None
  - 20260902T224022098Z-0b724b4b:3: truth=AX-b951db got=None
  - 20260902T224022098Z-0b724b4b:4: truth=AX-d3e3b0 got=None
  - 20260902T212051681Z-b3fa0243:11: truth=None got=AX-dca8ca
  - 20260902T212125548Z-a7dc04f9:14: truth=None got=AX-dca8ca
  - 20260902T222416746Z-9da86e8a:9: truth=None got=AX-dca8ca
  - 20260902T222624770Z-8ca43cec:13: truth=None got=AX-dca8ca
  - 20260902T224022098Z-0b724b4b:16: truth=None got=AX-dca8ca
  - 20260903T124553384Z-e9d54922:3: truth=AX-b951db got=None
  - 20260903T124711641Z-a3965c8c:6: truth=AX-b951db got=None
  - 20260903T125955537Z-2e803da5:2: truth=AX-b951db got=None
  - 20260907T101625725Z-72d2adeb:1: truth=AX-b951db got=None
  - 20260907T220829661Z-a9807505:1: truth=AX-b951db got=None
  - 20260908T115807384Z-21e79436:2: truth=AX-b951db got=None

## Part 2 — matched-pair probes

| # | axiom | kind | truth | A (examples) | B (statement-only) |
|---|-------|------|-------|---|---|
| 1 | AX-b951db | true-far | AX-b951db | AX-b951db | AX-b951db |
| 2 | AX-b951db | true-far | AX-b951db | AX-b951db | AX-b951db |
| 3 | AX-b951db | false-near | None | None | None |
| 4 | AX-b951db | false-near | None | None | None |
| 5 | AX-2559f7 | true-far | AX-2559f7 | AX-2559f7 | AX-2559f7 |
| 6 | AX-2559f7 | true-far | AX-2559f7 | AX-2559f7 | AX-2559f7 |
| 7 | AX-2559f7 | false-near | None | None | None |
| 8 | AX-2559f7 | false-near | None | None | None |
| 9 | AX-9a7dd5 | true-far | AX-9a7dd5 | AX-9a7dd5 | AX-9a7dd5 |
| 10 | AX-9a7dd5 | true-far | AX-9a7dd5 | AX-9a7dd5 | AX-9a7dd5 |
| 11 | AX-9a7dd5 | false-near | None | None | None |
| 12 | AX-9a7dd5 | false-near | None | None | None |

**Bias signature** (examples-bias predicts A > B on both):
- A: clean
- B: clean
