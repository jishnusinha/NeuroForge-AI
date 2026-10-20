# Review fixes

## Experiment flow

- Playground fitting is explicit. Edits invalidate the saved result; K-means no longer writes its output back into input state or repeatedly retriggers fitting.
- Save Run captures the actual dataset points, configuration, evaluation fingerprint, metrics, and history. Runs without a completed current result cannot be saved.
- Dataset Explorer, lessons, command shortcuts, report reopening, and Arena forks carry configuration into the selected workspace. Forking creates a new draft and preserves the original run.
- Playground datasets and Studio architectures support up to 50 undo steps. Desktop panels support native resizing; narrower screens stack the visualization before controls.
- Academy progress is saved in this browser after correct answers. Progress is not account-synchronized.

## Training and evaluation

- Logistic initialization and TensorFlow initializers use seed 42. TensorFlow uses fixed sample order; runtime version and backend are recorded. Different numerical backends can still produce small differences.
- Moving the inspection probe does not rebuild the model. Stop waits for the training job to finish; architecture changes and reset are guarded during training. A new training action starts from seeded initial weights.
- Studio exposes learning rate, epochs, optimizer, and batch size. Recorded checkpoints can be inspected during the current session. Reopening a report restores configuration for a new run; it does not restore optimizer state or historical checkpoint weights.
- Arena plots recorded history, leaves missing measurements unavailable, and requires matching task, dataset, split, and preprocessing fingerprints for direct comparison. Clustering can be inspected individually.
- Overfitting observations derive from recorded validation loss rising after its minimum while training loss falls. They are evidence of a possible trend, not a causal guarantee.
- Regression residual metrics, gradient-descent parameters, K-means step inertia, classification thresholds, and empty-evaluation handling have regression coverage.

## Persistence and ownership

- Development requests use `/api`, proxied by Vite to port 5000. Set `VITE_API_URL` when hosting the API at another origin, or configure the production host to proxy `/api`.
- Connected MongoDB saves persist across server restarts. Without MongoDB, server records are temporary and labeled accordingly. Offline saves remain in the browser and are merged with server listings.
- Browser identity is an unguessable local token; the server stores its hash and scopes listing and deletion to that owner. This is anonymous browser ownership, not a full account/sign-in system. Clearing browser storage loses that identity.
- Report links are public read-only capability links. Share IDs resolve from MongoDB and memory. Offline-only reports must be exported instead of shared as a link.
- Server and local copies retain the same share ID. Failed deletion and failed local storage writes are reported instead of silently claiming success.
- Legacy mock records lack reproducibility metadata; Arena does not treat them as comparable or runnable.

## Validation

Run `npm test`, `npm --prefix client run lint`, and `npm --prefix client run build`.

The automated suite exercises numerical solvers, seeded XOR learning, validation metrics, cancellation, repeated-job tensor cleanup, local/server persistence, HTTP ownership, and decision-surface geometry. Phase 0 adds a real isolated MongoDB integration suite in addition to the model-stub regression.

Phase 0 adds automated Chromium desktop/mobile journeys against the production build in database and temporary-memory modes. Screenshots, failure traces, and load/training measurements are retained under `.artifacts/`. See [Phase 0 contracts](PHASE_0_CONTRACTS.md). Suggested additional manual checks:

1. Open Gaussian Blobs, run K-means, drag a centroid, step, undo data edits, and save.
2. Train XOR in Studio, move the probe, inspect a checkpoint, start a new run, and stop it.
3. Save a linear baseline and hidden-layer run from Showcase, then compare their recorded curves in Arena.
4. Open a saved report by share ID, fork it, and verify its dataset and settings.
5. Test offline saves, storage failures, mobile layout, keyboard inspection controls, and reduced-motion settings.
