import os
import subprocess
import sys
from pathlib import Path

root = Path('.artifacts/academy-executable').resolve()
expected = {
    'house-prices', 'telecom-churn', 'flower-species', 'retail-purchase',
    'delivery-times', 'energy-use', 'manufacturing-defects',
    'customer-segmentation', 'loan-payment-risk', 'product-returns',
}
found = {path.stem for path in root.glob('*.py')}
if found != expected:
    raise SystemExit(f'Expected ten Academy scripts, found {len(found)}: {sorted(found)}')

env = dict(os.environ, MPLBACKEND='Agg')
for case_id in sorted(expected):
    result = subprocess.run(
        [sys.executable, f'{case_id}.py'], cwd=root, env=env,
        text=True, capture_output=True, timeout=120,
    )
    if result.returncode:
        raise SystemExit(f'{case_id} example failed:\n{result.stdout}\n{result.stderr}')
    expected_output = '-clusters.png' if case_id == 'customer-segmentation' else '-results.png'
    if not (root / f'{case_id}{expected_output}').is_file():
        raise SystemExit(f'{case_id} example did not create its measured output chart')
    print(f'Executed Academy example: {case_id}')
