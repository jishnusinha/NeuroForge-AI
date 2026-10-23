import {simulationConfig} from '../../ml/optimization/traceContracts.js';
import {optimizationKernelSource} from './optimizationKernelSource.js';
export function optimizationJavascript(configs){const safe=configs.map(simulationConfig);return `// Exact objective/trace reproduction, F22 v1. Node.js 24; no dependencies.
// Pure reviewed mathematical engine, seeded examples only; no imported rows or model weights.
${optimizationKernelSource}
const configurations=${JSON.stringify(safe,null,2)};
console.log(JSON.stringify(configurations.map(simulate)));
`;}
export function optimizationPython(configs,{framework=true}={}){const safe=configs.map(simulationConfig);return `# NeuroForge F22 v1: exact objective/trace reproduction, float64 CPU
# Python 3.12, torch==2.5.1; python neuroforge-optimization.py
# Nesterov uses explicit look-ahead, not torch.optim.SGD(nesterov=True).
# SGD samples actual seeded training examples with replacement; no imported data.
import json, math
import torch
torch.set_num_threads(1)
torch.set_default_dtype(torch.float64)
CONFIGURATIONS = json.loads(${JSON.stringify(JSON.stringify(safe))})

def stream(seed):
    while True:
        seed = (1664525 * seed + 1013904223) & 0xffffffff
        yield seed / 4294967296

def experiment(c):
    identity = c['objectiveId']
    domain = {'bowl':[[-4,4],[-4,4]], 'multiwell':[[-1.5,1.5],[-1.5,1.5]], 'rosenbrock':[[-2,2],[-1,3]], 'saddle':[[-2,2],[-2,2]]}.get(identity, [[-4,4],[-4,4]])
    data_rng = stream(c['seed'])
    rows = []
    for _ in range(48):
        a, b = 2*next(data_rng)-1, 2*next(data_rng)-1
        rows.append([a,b,.4+1.2*a if identity=='linear_data' else float(a+.6*b>0)])
    data = torch.tensor(rows[:32])  # fixed training subset only; rows 32:48 never fit
    def objective(p, batch=None):
        x,y = p[0],p[1]
        if identity=='bowl': return .5*(x*x+6*y*y)
        if identity=='multiwell': return (x*x-1)**2+(y*y-1)**2
        if identity=='rosenbrock': return (1-x)**2+100*(y-x*x)**2
        if identity=='saddle': return x*x-y*y
        d = data if batch is None else data[batch]
        if identity=='linear_data': value = ((x*d[:,0]+y-d[:,2])**2).mean()
        else:
            f = torch.stack((torch.tanh(2*d[:,0]+d[:,1]),torch.tanh(d[:,0]-2*d[:,1])),dim=1) if identity=='neural_slice' else d[:,:2]
            z = x*f[:,0]+y*f[:,1]
            value = torch.nn.functional.binary_cross_entropy_with_logits(z,d[:,2])
        return value + .005*(x*x+y*y)
    p = torch.nn.Parameter(torch.tensor(c['start'],dtype=torch.float64))  # shape [2]; all other weights/data frozen
    method = c['optimizerId']
    use_framework = ${framework?'True':'False'} and method!='nesterov'
    if use_framework:
        if method in ('gd','sgd','momentum'): opt=torch.optim.SGD([p],lr=c['learningRate'],momentum=c['momentum'] if method=='momentum' else 0)
        elif method=='adagrad': opt=torch.optim.Adagrad([p],lr=c['learningRate'],eps=c['epsilon'])
        elif method=='rmsprop': opt=torch.optim.RMSprop([p],lr=c['learningRate'],alpha=c['beta2'],eps=c['epsilon'],centered=False)
        elif method=='adam': opt=torch.optim.Adam([p],lr=c['learningRate'],betas=(c['beta1'],c['beta2']),eps=c['epsilon'])
        else: opt=torch.optim.AdamW([p],lr=c['learningRate'],betas=(c['beta1'],c['beta2']),eps=c['epsilon'],weight_decay=c['weightDecay'])
    velocity,first,second = [torch.zeros(2) for _ in range(3)]
    batch_rng=stream(c['seed']); history=[]; status='completed'
    for t in range(c['steps']+1):
        loss=objective(p)
        full_gradient=torch.autograd.grad(loss,p)[0]
        history.append({'step':t,'theta':p.detach().tolist(),'loss':loss.item(),'gradient':full_gradient.tolist()})
        if t==c['steps']: break
        if method!='sgd' and c['tolerance']>0 and torch.linalg.vector_norm(full_gradient).item()<=c['tolerance']:
            status='converged';break
        batch=[int(next(batch_rng)*32) for _ in range(c['batchSize'])] if method=='sgd' else None
        if method=='nesterov':
            look=(p.detach()-c['learningRate']*c['momentum']*velocity).requires_grad_(True)
            g=torch.autograd.grad(objective(look,batch),look)[0]
        else: g=torch.autograd.grad(objective(p,batch),p)[0]
        before=p.detach().clone()
        if use_framework:
            opt.zero_grad();p.grad=g;opt.step()
        else:
            if method in ('momentum','nesterov'):
                velocity=c['momentum']*velocity+g;direction=velocity
            elif method in ('adagrad','rmsprop'):
                second=second+g*g if method=='adagrad' else c['beta2']*second+(1-c['beta2'])*g*g
                direction=g/(torch.sqrt(second)+c['epsilon'])
            elif method in ('adam','adamw'):
                first=c['beta1']*first+(1-c['beta1'])*g
                second=c['beta2']*second+(1-c['beta2'])*g*g
                direction=(first/(1-c['beta1']**(t+1)))/(torch.sqrt(second/(1-c['beta2']**(t+1)))+c['epsilon'])
            else: direction=g
            with torch.no_grad(): p.copy_(before-c['learningRate']*direction-(c['learningRate']*c['weightDecay']*before if method=='adamw' else 0))
        next_loss=objective(p).item()
        permitted=all(abs(v)<=1e5 for v in p.detach().tolist()) if c['permittedDomain']=='legacy' else all(domain[i][0]<=v<=domain[i][1] for i,v in enumerate(p.detach().tolist()))
        if not torch.isfinite(p).all() or not math.isfinite(next_loss) or abs(next_loss)>1e12: status='diverged';break
        if not permitted: status='diverged' if c['permittedDomain']=='legacy' else 'out_of_domain';break
        history[-1]['nextBatch']=batch
    return {'config':c,'history':history,'status':status}
print(json.dumps([experiment(c) for c in CONFIGURATIONS],allow_nan=False))
`;}
