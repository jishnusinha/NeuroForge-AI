# F22.0 — Universal Code Companion

This implements the first reviewable phase of the F22 plan. The plan's optimizer-engine and 3D-atlas phases depend on review and manual merge of F22.0. F22.1–F22.5 are not implemented by this change.

## Available experience

Open **F22 — ML / DL Code Companion** below Playground, Neural Studio, or F12 Model Workbench. The panel loads on demand. Concept, From scratch, Framework, Experiment recipe, and Observed evidence tabs share the current reviewed settings. Beginner mode adds shape explanations; Advanced mode retains the same executable code. Python and JavaScript examples have line numbers, copy, source download, and context JSON download. JavaScript uses `.mjs` so Node interprets the downloaded file as an ES module without requiring a package configuration.

| Entry | Reviewed examples |
| --- | --- |
| Playground | Linear regression (OLS or gradient descent), logistic regression |
| Neural Studio | Configured dense network, SGD, momentum, Adam |
| F12 | Regression/classification baseline, ridge, binary logistic regression |

Unsupported models explicitly show that no reviewed F22.0 template exists. They do not silently substitute another algorithm. Broader model templates and learning integrations belong to F22.4.

## Scientific and privacy contract

These are **synthetic learning examples**, not exact reproductions of source-data browser runs. An immutable, versioned context allowlists dimensions, layers, activations, optimizer, learning rate, regularization, epoch budget, batch size, seed, and decision threshold. Imported observations, original feature names, row identifiers, source splits, fitted pipelines, weights, receipts, and arbitrary extra properties never enter generated code or context downloads. Generated text is displayed as plain text and is never executed in the browser.

Each example creates 40 observations using a documented deterministic LCG (1664525, 1013904223, modulus 2^32), trains on the first 32, and validates on the final eight. Feature names are generic. Preprocessing statistics for ridge come from training observations only. There is no final-test access. Closed-form methods use zero optimizer updates. Iterative examples use the selected fixed epoch budget; browser early stopping and historical checkpoints are not reproduced.

NumPy and native JavaScript implement the same synthetic initialization and numerical recipe, checked by the fixture verifier. PyTorch and TF.js implement actual framework training, with explicitly different initialization and precision; their neural results are not claimed to match the browser or scratch implementations. Baselines and closed-form solutions have separate parity checks. Observed browser aggregates appear in a separate table, preserve unavailable values, and are excluded from example exports.

## Modules and execution

`client/src/codegen/learning/` contains the context contract, allowlisted template registry, NumPy/PyTorch templates, and native JavaScript/TF.js templates. `CodeCompanionEntry` lazy-loads the shared panel. Its CSS uses PRISM theme tokens and bounded source scrolling.

Generated Python scratch examples require Python 3.12 and `numpy==2.2.6`; framework examples require `torch==2.5.1`. Native JavaScript runs with Node.js 24. TF.js examples require `@tensorflow/tfjs@4.22.0`. Each script prints finite validation metrics, predictions, dimensions, and update counts as JSON. Framework examples use real backpropagation and optimizer updates. TF.js examples dispose their model, optimizer, and tensors.

## Verification and review

Run:

```text
npm test
npm run lint
npm run build:client
npm run fixtures:f22
python scripts/verify-learning-code-f22.py
node scripts/run-browser-tests.mjs memory tests/e2e/learning-code-f22.spec.mjs
node scripts/run-browser-tests.mjs database tests/e2e/learning-code-f22.spec.mjs
```

The fixture command exports ten contexts in four implementations and executes all twenty JavaScript programs. The Python verifier compiles and executes twenty Python programs, checks finite values and shapes, and compares NumPy outputs with the JavaScript references. CI installs CPU PyTorch and runs this verifier after the existing chart Python checks.

Local verification on 2026-10-22: all 266 Node tests, strict lint, production build, twenty generated JavaScript programs, eight new desktop/mobile browser cases in both memory and real MongoDB modes, and the MongoDB integration test passed. Fifty existing browser regression cases passed across training, F8 optimization, F12 models, F18 charts/exports, and F21 performance. TF.js examples leave zero tensors allocated after cleanup. The isolated Pages build passed asset-prefix verification and companion hash-route, lazy-load, and download smoke checks at 390px and 1440px; screenshots were inspected. Run `node scripts/verify-learning-pages-f22.mjs` after the isolated build (or pass a Pages build directory). CI runs this check against its existing static build.

Python is not installed on this workstation, so Python execution remains a CI gate rather than a local pass claim. No deployment or external pull request was performed.

For manual review, change Studio's model seed and check the framework source and downloaded context. Copy and download both languages. Switch all four themes and keyboard-navigate the tabs. Select an unsupported Playground algorithm and verify the explicit unavailable state. Confirm opening or exporting examples never starts training, saves a run, or evaluates the final test. Review the existing F8 optimizer and F18 chart flows before merging. Subsequent F22 phases remain pending; this change does not introduce a 3D renderer, new objective engine, or optimizer race.
