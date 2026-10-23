const encoded=c=>JSON.stringify(c);
export function pythonScratch(c){return `# NeuroForge synthetic example only / template v1
# Dependencies: Python 3.12, numpy==2.2.6. Run: python neuroforge-example.py
# No imported observations, source split, fitted preprocessing or model weights are included.
import json
import numpy as np

C = json.loads(${JSON.stringify(encoded(c))})
state = C['seed'] & 0xffffffff
def random():
    global state
    state = (1664525 * state + 1013904223) & 0xffffffff
    return state / 4294967296

X = np.array([[2 * random() - 1 for _ in range(C['features'])] for _ in range(40)], dtype=np.float64)
if C['task'] == 'regression':
    y = .3 + X @ (np.arange(1, C['features'] + 1) / C['features'])
elif C['family'] == 'mlp':
    y = ((X[:, 0] > 0) != (X[:, 1] > 0)).astype(float)
elif C['task'] == 'multiclass_classification':
    y = np.minimum(C['classCount'] - 1, ((X[:, 0] + 1) * C['classCount'] / 2).astype(int))
else:
    y = (X.sum(axis=1) > 0).astype(float)
y = y.reshape(-1, 1)  # [40, 1]; synthetic feature order is feature_1 ... feature_d
A, B = X[:32].copy(), X[32:].copy()
updates = 0

if C['family'] == 'baseline':
    constant = float(y[:32].mean()) if C['task'] == 'regression' else float(np.bincount(y[:32, 0].astype(int), minlength=C['classCount']).argmax())
    prediction = np.full((8, 1), constant)
elif C['method'] in ('ols', 'ridge'):
    if C['method'] == 'ridge':
        mean, scale = A.mean(axis=0), A.std(axis=0)
        scale = np.where(scale > 1e-12, scale, 1)
        A, B = (A - mean) / scale, (B - mean) / scale
    A, B = np.column_stack((np.ones(32), A)), np.column_stack((np.ones(8), B))
    if C['method'] == 'ols':
        weights = np.linalg.lstsq(A, y[:32], rcond=None)[0]
    else:
        penalty = np.eye(A.shape[1]) * C['lambda'] * 32
        penalty[0, 0] = 0
        weights = np.linalg.solve(A.T @ A + penalty, A.T @ y[:32])
    prediction = B @ weights
else:
    params = []
    for before, after in zip(C['layers'][:-1], C['layers'][1:]):
        n, m = before['units'], after['units']
        radius = np.sqrt(6 / (n + m))
        params.extend([np.array([(2 * random() - 1) * radius for _ in range(n * m)]).reshape(n, m), np.zeros(m)])
    memory = [[np.zeros_like(p) for p in params] for _ in range(3)]
    def activate(z, name):
        if name == 'ReLU': return np.maximum(z, 0)
        if name == 'Tanh': return np.tanh(z)
        if name == 'Sigmoid': return 1 / (1 + np.exp(-np.clip(z, -35, 35)))
        return z
    def derivative(a, name):
        if name == 'ReLU': return (a > 0).astype(float)
        if name == 'Tanh': return 1 - a * a
        if name == 'Sigmoid': return a * (1 - a)
        return np.ones_like(a)
    def forward(x):
        values = [x]
        for l, layer in enumerate(C['layers'][1:]):
            values.append(activate(values[-1] @ params[2*l] + params[2*l+1], layer['activation']))
        return values
    for epoch in range(C['epochs']):
        for start in range(0, 32, C['batchSize']):
            xb, target = A[start:start+C['batchSize']], y[start:min(start+C['batchSize'], 32)]
            values = forward(xb)
            delta = (values[-1] - target) / len(xb)
            if C['task'] == 'regression': delta *= 2
            gradients = [None] * len(params)
            for l in reversed(range(len(C['layers']) - 1)):
                gradients[2*l] = values[l].T @ delta + C['lambda'] * params[2*l]
                gradients[2*l+1] = delta.sum(axis=0)
                if l: delta = (delta @ params[2*l].T) * derivative(values[l], C['layers'][l]['activation'])
            updates += 1
            for i, gradient in enumerate(gradients):
                if C['optimizer'] == 'momentum':
                    memory[0][i] = .9 * memory[0][i] + gradient
                    update = memory[0][i]
                elif C['optimizer'] == 'adam':
                    memory[1][i] = .9 * memory[1][i] + .1 * gradient
                    memory[2][i] = .999 * memory[2][i] + .001 * gradient**2
                    update = (memory[1][i] / (1 - .9**updates)) / (np.sqrt(memory[2][i] / (1 - .999**updates)) + 1e-8)
                else: update = gradient
                params[i] -= C['learningRate'] * update
                if not np.isfinite(params[i]).all(): raise FloatingPointError('Example diverged; lower the learning rate')
    prediction = forward(B)[-1]

if C['task'] == 'regression':
    score = float(np.mean((prediction - y[32:])**2)); metric = 'validation_mse'
else:
    predicted = prediction if C['family'] == 'baseline' else (prediction >= C['threshold']).astype(float)
    score = float(np.mean(predicted == y[32:])); metric = 'validation_accuracy'
print(json.dumps({'mode':'synthetic_example_only', 'metric':metric, 'value':score, 'updates':updates, 'prediction':prediction[:, 0].tolist(), 'features':C['features']}, allow_nan=False))
`;}

export function pythonFramework(c){return `# NeuroForge PyTorch analog on deterministic example data / template v1
# Dependencies: Python 3.12, torch==2.5.1. Run: python neuroforge-example.py
# Framework initialization differs from NumPy/TF.js. This does not replay a saved browser model.
import json
import torch
from torch import nn
torch.set_num_threads(1)
torch.manual_seed(${c.seed})
torch.set_default_dtype(torch.float64)
C = json.loads(${JSON.stringify(encoded(c))})
state = C['seed'] & 0xffffffff
def random():
    global state
    state = (1664525 * state + 1013904223) & 0xffffffff
    return state / 4294967296
X = torch.tensor([[2 * random() - 1 for _ in range(C['features'])] for _ in range(40)])
if C['task'] == 'regression': y = .3 + X @ (torch.arange(1, C['features'] + 1) / C['features'])
elif C['family'] == 'mlp': y = ((X[:, 0] > 0) != (X[:, 1] > 0)).double()
elif C['task'] == 'multiclass_classification': y = ((X[:, 0] + 1) * C['classCount'] / 2).long().clamp(max=C['classCount'] - 1).double()
else: y = (X.sum(dim=1) > 0).double()
y = y.reshape(-1, 1)
A, B = X[:32].clone(), X[32:].clone()
updates = 0
if C['family'] == 'baseline':
    constant = y[:32].mean() if C['task'] == 'regression' else torch.bincount(y[:32, 0].long(), minlength=C['classCount']).argmax().double()
    prediction = torch.ones((8, 1)) * constant
elif C['method'] in ('ols', 'ridge'):
    if C['method'] == 'ridge':
        mean, scale = A.mean(dim=0), A.std(dim=0, correction=0)
        scale = torch.where(scale > 1e-12, scale, 1.)
        A, B = (A - mean) / scale, (B - mean) / scale
    A, B = torch.cat((torch.ones((32, 1)), A), dim=1), torch.cat((torch.ones((8, 1)), B), dim=1)
    if C['method'] == 'ols': weights = torch.linalg.lstsq(A, y[:32]).solution
    else:
        penalty = torch.eye(A.shape[1]) * C['lambda'] * 32
        penalty[0, 0] = 0
        weights = torch.linalg.solve(A.T @ A + penalty, A.T @ y[:32])
    prediction = B @ weights
else:
    layers = []
    activations = {'Linear':nn.Identity, 'ReLU':nn.ReLU, 'Tanh':nn.Tanh, 'Sigmoid':nn.Sigmoid}
    for before, after in zip(C['layers'][:-1], C['layers'][1:]):
        layers.extend([nn.Linear(before['units'], after['units']), activations[after['activation']]()])
    model = nn.Sequential(*layers)  # [batch, d] -> dense layers -> [batch, 1]
    if C['optimizer'] == 'adam': opt = torch.optim.Adam(model.parameters(), lr=C['learningRate'])
    else: opt = torch.optim.SGD(model.parameters(), lr=C['learningRate'], momentum=.9 if C['optimizer'] == 'momentum' else 0)
    criterion = nn.MSELoss() if C['task'] == 'regression' else nn.BCELoss()
    model.train()
    for epoch in range(C['epochs']):
        for start in range(0, 32, C['batchSize']):
            opt.zero_grad()
            loss = criterion(model(A[start:start+C['batchSize']]), y[start:min(start+C['batchSize'], 32)])
            loss = loss + C['lambda'] / 2 * sum((p*p).sum() for name, p in model.named_parameters() if name.endswith('weight'))
            if not torch.isfinite(loss): raise FloatingPointError('Example diverged; lower the learning rate')
            loss.backward()
            opt.step()
            updates += 1
    # An in-memory checkpoint of this synthetic model only, never source/browser weights.
    checkpoint = {name: value.detach().clone() for name, value in model.state_dict().items()}
    model.load_state_dict(checkpoint)
    model.eval()
    with torch.no_grad(): prediction = model(B)
if C['task'] == 'regression': score, metric = ((prediction - y[32:])**2).mean().item(), 'validation_mse'
else:
    predicted = prediction if C['family'] == 'baseline' else (prediction >= C['threshold']).double()
    score, metric = (predicted == y[32:]).double().mean().item(), 'validation_accuracy'
print(json.dumps({'mode':'synthetic_example_only', 'metric':metric, 'value':score, 'updates':updates, 'prediction':prediction[:, 0].tolist(), 'features':C['features']}, allow_nan=False))
`;}
