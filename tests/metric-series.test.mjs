import test from 'node:test';
import assert from 'node:assert/strict';
import { recordedMetricRows, metricHistoryPath } from '../client/src/ml/metricSeries.js';

test('Arena aligns exact observed epochs without inferred samples', () => {
  const baseline = [{ epoch: 1, loss: .4, valLoss: .5 }, { epoch: 3, loss: .2 }];
  const variant = [{ epoch: 1, loss: .3, valLoss: .35 }, { epoch: 2, loss: .24, valLoss: NaN }];
  assert.deepEqual(recordedMetricRows([baseline, variant], ['loss', 'valLoss']), [
    { epoch: 1, values: [.4, .5, .3, .35] },
    { epoch: 2, values: [null, null, .24, null] },
    { epoch: 3, values: [.2, null, null, null] },
  ]);
});

test('Arena curves break on missing values and unrecorded epochs', () => {
  const path = metricHistoryPath([
    { epoch: 1, loss: .4 }, { epoch: 2, loss: null },
    { epoch: 3, loss: .2 }, { epoch: 5, loss: .1 },
  ], 'loss', 5, .5);
  assert.equal((path.match(/M/g) || []).length, 3);
  assert.equal((path.match(/L/g) || []).length, 0);
  assert.equal(metricHistoryPath([{ epoch: 1 }, { epoch: 2, loss: NaN }], 'loss', 2, 1), '');
});

test('Arena retains recorded zero and skips non-numeric epoch identifiers', () => {
  assert.deepEqual(recordedMetricRows([[{ epoch: 0, loss: 0 }, { epoch: '1', loss: 3 }], []], ['loss']), [
    { epoch: 0, values: [0, null] },
  ]);
  assert.equal((metricHistoryPath([{ epoch: 0, loss: 0 }, { epoch: 1, loss: .2 }], 'loss', 1, 1).match(/ L/g) || []).length, 1);
});
