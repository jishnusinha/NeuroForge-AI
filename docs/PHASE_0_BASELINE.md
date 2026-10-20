# Phase 0 implementation baseline

Status: Phase 0 implemented and verified. This baseline establishes a repeatable development gate; it is not a declaration that the full roadmap is production-ready.

## Delivered

- Playwright desktop (1440×1000) and mobile viewport (390×844) smoke journeys against the actual production build.
- Separate isolated real-MongoDB and temporary-memory browser modes.
- Real MongoDB integration covering persistence after disconnect/reconnect, share lookup, owner isolation, deletion, and unavailable-database behavior.
- Strict lint with warnings denied, regression tests, production build, a combined `npm run check` command, and a GitHub Actions verification workflow.
- Reference screenshots, failure traces, browser load measurements, and training/stop measurements retained as test artifacts.
- Product/state/limit contracts documented in [PHASE_0_CONTRACTS.md](PHASE_0_CONTRACTS.md).

## Corrections made while establishing the baseline

- Studio restores incoming configuration as initial state, avoiding an intermediate default model and effect-driven reconstruction. Imported dataset noise metadata is preserved.
- Playground results are associated with an exact input/configuration key. A changed configuration is stale immediately, before an effect can accidentally associate old results with new inputs.
- A fresh or stale draft displays no current measurements instead of presenting default zero accuracy or claiming an uncomputed solution exists.
- The landing page mounts the command palette and notification surface. Dialog search state resets through dialog lifecycle and keyboard commands preserve focus appropriately.
- The landing canvas honors reduced motion and recalculates node positions when resized.
- The Studio decision surface uses an explicit square grid rather than an unavailable Tailwind column class. Predictions are sampled at cell centers, and point overlays use the grid's declared bounds.
- Loss and accuracy history bars have an actual height context; zero values are not replaced by decorative nonzero values.
- Essential plot/probe controls and notifications expose accessible labels/status roles.
- Manual dataset drawing enforces the same 2,000-point limit used by saving and neural training.
- API startup is separated from app construction for isolated tests. Liveness and readiness are distinct. Production database outages return 503 rather than silently accepting temporary-memory writes; malformed/oversized JSON receives a JSON error response.
- Unused code and the identified hook warnings are resolved without disabling lint rules.

## Verification evidence

| Check | Result |
| --- | --- |
| Unit/regression suite | 14 passed |
| Real MongoDB integration | 1 passed |
| Database-backed Chromium journeys | 14 passed; desktop and mobile viewport |
| Temporary-memory Chromium journeys | 14 passed; desktop and mobile viewport |
| Client lint with warnings denied | Passed, no warnings |
| Production build, syntax and whitespace checks | Passed |
| Eight repeated CPU training/disposal cycles | Retained tensors returned to zero after every cycle |

Observed timing samples from the final local run:

| Storage / viewport | Playground ready | Studio model ready | Ten training epochs | Stop UI completion |
| --- | --- | --- | --- | --- |
| MongoDB / desktop | 751 ms | 3,242 ms | 10,198 ms | 492 ms |
| MongoDB / mobile | 689 ms | 3,599 ms | 6,923 ms | 379 ms |
| Memory / desktop | 1,107 ms | 3,321 ms | 7,527 ms | 646 ms |
| Memory / mobile | 776 ms | 2,534 ms | 6,665 ms | 1,591 ms |

These are single observed end-to-end test timings, including browser action/scroll/assertion overhead. The storage-mode suites shared host resources. They are not percentiles, pure engine benchmarks, or release latency guarantees.

Final results and measured values are collected in `.artifacts/verification-summary.json` with `npm run baseline:summary`. Per-mode HTML reports and screenshots are under `.artifacts/e2e-database` and `.artifacts/e2e-memory`.

The local reference environment uses Node 24 on Windows and Chromium 156 with software-rendered WebGL. Mobile runs emulate a viewport and touch-capable browser context; they do not certify behavior on physical iOS/Android devices. Browser timings are observations from this shared development environment, not production service-level promises.

The numerical suite includes eight train/inspect/dispose cycles and checks that retained tensor counts return to their starting value after every cycle. Browser tests additionally verify training, inspection, checkpoint selection, and cancellation using the browser runtime.

The workflow file is prepared for CI; hosted GitHub Actions execution has not been observed locally.

## Remaining work assigned to later phases

- Phase 1: separate project, dataset version, draft, run, evaluation protocol, and artifact contracts, with compatibility migration.
- Phase 2: complete workspace interaction redesign, accessible resize controls, chart conventions, fit-to-data/touch interaction, and physical-device verification.
- Phase 3: IndexedDB autosave, draft recovery, storage upgrades, and cross-tab revision handling. Current drafts still reset on a full reload; completed saved runs do not.
- Phase 4: account authentication, durable cloud project ownership, synchronization/conflict handling, revocable/private sharing, and retention.
- Phase 5: persistent trained models, a page-independent runner, worker/backend capability handling, and artifact lifecycle.

The Studio bundle remains approximately 898 kB before compression (230 kB gzip). It is route-loaded rather than part of the initial page bundle. The build warning remains visible and is assigned to performance work rather than hidden through a higher warning threshold.

## Next implementation slice

The baseline gate passed. The next slice is the Phase 1 contracts and compatibility adapter for a guest project containing a dataset version, a draft, and an immutable run. Durable recovery is implemented through the Phase 3 repository; it must not be advertised before its transaction/recovery tests pass.
