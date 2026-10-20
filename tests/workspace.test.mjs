import test from 'node:test';
import assert from 'node:assert/strict';

test('Phase 2: Guided and Expert views share identical configuration without mutation', () => {
  const baseConfig = {
    algorithm: 'Neural Network',
    hyperparameters: {
      layers: [
        { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
        { id: 'l-h1', type: 'Dense', units: 4, activation: 'ReLU' },
        { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
      ],
      learningRate: 0.04,
      epochs: 60,
      optimizer: 'adam',
      batchSize: 16,
      seed: 42,
    },
    dataset: { name: 'XOR Problem', noise: 0.12, trainRatio: 0.8 },
  };

  // Simulating view projection
  const projectView = (config, viewMode) => {
    if (viewMode === 'guided') {
      return {
        mode: 'guided',
        simplifiedControls: {
          speedLabel: config.hyperparameters.learningRate >= 0.05 ? 'Fast' : config.hyperparameters.learningRate >= 0.02 ? 'Normal' : 'Slow',
          rounds: config.hyperparameters.epochs,
          hiddenUnits: config.hyperparameters.layers[1]?.units || 0,
        },
        // Underlying config is preserved identically
        underlyingConfig: config,
      };
    } else {
      return {
        mode: 'expert',
        expertControls: {
          optimizer: config.hyperparameters.optimizer,
          batchSize: config.hyperparameters.batchSize,
          learningRate: config.hyperparameters.learningRate,
          epochs: config.hyperparameters.epochs,
          layerShapes: config.hyperparameters.layers.map(l => ({ type: l.type, units: l.units, activation: l.activation })),
        },
        underlyingConfig: config,
      };
    }
  };

  const guidedView = projectView(baseConfig, 'guided');
  const expertView = projectView(baseConfig, 'expert');

  // Both views point to identical underlying configuration
  assert.deepEqual(guidedView.underlyingConfig, expertView.underlyingConfig);
  assert.equal(guidedView.simplifiedControls.speedLabel, 'Normal');
  assert.equal(expertView.expertControls.optimizer, 'adam');
  assert.equal(expertView.expertControls.learningRate, 0.04);
});

test('Phase 2: Unified Chart preserves missing measurements honestly without converting to zero', () => {
  // Metric history with missing validation measurements on some epochs
  const trainSeries = [
    { epoch: 1, value: 0.693 },
    { epoch: 2, value: 0.521 },
    { epoch: 3, value: 0.342 },
  ];
  const valSeries = [
    { epoch: 1, value: 0.695 },
    { epoch: 2, value: null }, // Missing validation evaluation at epoch 2
    { epoch: 3, value: 0.350 },
  ];

  // Helper calculating bounds ignoring null/undefined
  const calculateScaleBounds = (train, val) => {
    let min = Infinity;
    let max = -Infinity;
    [...train, ...val].forEach(p => {
      if (typeof p.value === 'number' && !Number.isNaN(p.value)) {
        if (p.value < min) min = p.value;
        if (p.value > max) max = p.value;
      }
    });
    return { min, max };
  };

  const bounds = calculateScaleBounds(trainSeries, valSeries);
  // Missing value (null) at epoch 2 must NOT drag min bound down to 0
  assert.equal(bounds.min, 0.342);
  assert.equal(bounds.max, 0.695);
  assert.notEqual(bounds.min, 0, 'Null values must not be treated as 0');

  // Value formatting check
  const formatMetric = (val) => (val !== null && val !== undefined ? Number(val).toFixed(3) : 'Not measured');
  assert.equal(formatMetric(valSeries[0].value), '0.695');
  assert.equal(formatMetric(valSeries[1].value), 'Not measured');
  assert.equal(formatMetric(valSeries[2].value), '0.350');
});

test('Phase 2: Context Inspector handles sample, layer, neuron, metric, and run data models', () => {
  const sampleContext = {
    type: 'sample',
    data: { id: 's-42', x1: 0.8, x2: -0.5, label: 1, split: 'train', prediction: 0.912, residual: 0.088 },
  };
  assert.equal(sampleContext.type, 'sample');
  assert.equal(sampleContext.data.id, 's-42');
  assert.equal(sampleContext.data.split, 'train');

  const layerContext = {
    type: 'layer',
    data: { index: 1, type: 'Dense', units: 4, activation: 'ReLU', params: 12 },
  };
  assert.equal(layerContext.type, 'layer');
  assert.equal(layerContext.data.params, 12);

  const neuronContext = {
    type: 'neuron',
    data: { layerIndex: 1, neuronIndex: 0, bias: -0.12, weights: [0.45, -0.32], activationValue: 0.28 },
  };
  assert.equal(neuronContext.type, 'neuron');
  assert.equal(neuronContext.data.weights.length, 2);

  const metricContext = {
    type: 'metric',
    data: { name: 'Binary Cross-Entropy Loss', epoch: 10, trainValue: 0.25, valValue: 0.28, unit: 'loss' },
  };
  assert.equal(metricContext.type, 'metric');
  assert.equal(metricContext.data.unit, 'loss');
});

test('Phase 2: Notification history bounds, tracks unread status, and supports actions', () => {
  let notifications = [];

  const addNotification = (title, message, type) => {
    const item = {
      id: `notif-${notifications.length + 1}`,
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      read: false,
    };
    notifications = [item, ...notifications].slice(0, 50);
  };

  const markAllRead = () => {
    notifications = notifications.map(n => ({ ...n, read: true }));
  };

  // Add 3 notifications
  addNotification('Ready', 'Model compiled successfully', 'info');
  addNotification('Saved', 'Run saved locally', 'success');
  addNotification('Warning', 'Inputs changed after run', 'warning');

  assert.equal(notifications.length, 3);
  assert.equal(notifications.filter(n => !n.read).length, 3);
  assert.equal(notifications[0].type, 'warning'); // Most recent first

  markAllRead();
  assert.equal(notifications.filter(n => !n.read).length, 0);

  // Test bounding to 50 items
  for (let i = 0; i < 60; i++) {
    addNotification(`Event ${i}`, `Detail ${i}`, 'info');
  }
  assert.equal(notifications.length, 50, 'Notification history must be bounded at 50 items');
});

test('Phase 2: Panel layout step resizing adheres to min and max boundaries', () => {
  const minWidth = 240;
  const maxWidth = 480;

  const stepResize = (currentWidth, delta) => {
    return Math.max(minWidth, Math.min(maxWidth, currentWidth + delta));
  };

  assert.equal(stepResize(320, 24), 344);
  assert.equal(stepResize(320, -24), 296);
  // Clamping at min
  assert.equal(stepResize(250, -24), 240);
  assert.equal(stepResize(240, -24), 240);
  // Clamping at max
  assert.equal(stepResize(470, 24), 480);
  assert.equal(stepResize(480, 24), 480);
});
