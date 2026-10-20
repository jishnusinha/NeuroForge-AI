import { useState, useMemo } from 'react';
import { 
  Cpu, 
  Layers, 
  AlertTriangle, 
  CheckCircle2, 
  Binary
} from 'lucide-react';
import { 
  validateNetworkTopology, 
  forwardPassWalkthrough, 
  detectInactiveReLUs,
  verifyGradientsWithFiniteDifference 
} from '../../ml/neuralDiagnostics.js';

export default function NeuralStudioDiagnostics({
  layers = [
    { id: 'l-in', type: 'Input', units: 2, activation: 'Linear' },
    { id: 'l-h1', type: 'Dense', units: 3, activation: 'ReLU' },
    { id: 'l-out', type: 'Output', units: 1, activation: 'Sigmoid' },
  ],
  weightsAndBiases = null,
  sample = [0.5, -0.5],
  batchSamples = [],
  className = ''
}) {
  const [activeTab, setActiveTab] = useState('forward'); // 'forward', 'topology', 'gradients'
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  const resolvedWeights = useMemo(() => weightsAndBiases || [], [weightsAndBiases]);

  // Topology validation
  const topology = useMemo(() => {
    try {
      return validateNetworkTopology(layers);
    } catch {
      return null;
    }
  }, [layers]);

  // Forward pass walkthrough
  const walkthrough = useMemo(() => {
    try {
      return forwardPassWalkthrough(sample, resolvedWeights, layers);
    } catch {
      return null;
    }
  }, [sample, resolvedWeights, layers]);

  // Inactive ReLU diagnostics
  const inactiveReLUs = useMemo(() => {
    const testBatch = batchSamples.length > 0 ? batchSamples : [
      [0.5, 0.5], [-0.5, 0.5], [0.5, -0.5], [-0.5, -0.5], [1.0, 1.0], [-1.0, -1.0]
    ];
    return detectInactiveReLUs(testBatch.slice(0,128), resolvedWeights, layers);
  }, [batchSamples, resolvedWeights, layers]);

  // Gradient check
  const gradientVerification = useMemo(() => {
    if (activeTab !== 'gradients' || resolvedWeights.reduce((sum,w) => sum + w.biases.length + w.weights.flat().length,0) > 256) return null;
    try {
      return verifyGradientsWithFiniteDifference(
        sample, 
        1.0, 
        resolvedWeights, 
        layers
      );
    } catch {
      return null;
    }
  }, [sample, resolvedWeights, layers, activeTab]);

  const deadNeuronCount = inactiveReLUs.reduce((sum, r) => sum + r.deadNeurons.length, 0);

  return (
    <div className={`rounded-xl bg-[#151E30] border border-white/10 p-4 text-xs font-mono shadow-xl flex flex-col space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-[#A78BFA]" />
          <span className="font-semibold text-white tracking-wide">Neural Studio Diagnostics</span>
          {topology && (
            <span className="px-1.5 py-0.5 rounded bg-white/5 text-[10px] text-[#9EACC4]">
              {topology.totalParameters} params
            </span>
          )}
        </div>
        <div className="flex gap-1 bg-[#0A0F1D] p-0.5 rounded-lg border border-white/5">
          <button
            onClick={() => setActiveTab('forward')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'forward' ? 'bg-[#A78BFA] text-black font-semibold' : 'text-[#9EACC4] hover:text-white'
            }`}
          >
            Forward Walkthrough
          </button>
          <button
            onClick={() => setActiveTab('topology')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'topology' ? 'bg-[#A78BFA] text-black font-semibold' : 'text-[#9EACC4] hover:text-white'
            }`}
          >
            Architecture
          </button>
          <button
            onClick={() => setActiveTab('gradients')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              activeTab === 'gradients' ? 'bg-[#A78BFA] text-black font-semibold' : 'text-[#9EACC4] hover:text-white'
            }`}
          >
            Gradient Check
          </button>
        </div>
      </div>

      {/* Dead ReLU Warning */}
      {deadNeuronCount > 0 && (
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>
            Inactive Neurons Detected: {deadNeuronCount} ReLU neuron(s) fired 0 across all evaluated samples. Consider lowering the learning rate or testing LeakyReLU.
          </span>
        </div>
      )}

      {/* Tab: Forward Walkthrough */}
      {activeTab === 'forward' && walkthrough && (
        <div className="space-y-3">
          {/* Layer Step Navigation */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {walkthrough.steps.map((st, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStepIndex(idx)}
                className={`px-3 py-1.5 rounded-lg border text-left flex items-center gap-2 transition-all shrink-0 ${
                  activeStepIndex === idx
                    ? 'border-[#A78BFA] bg-[#A78BFA]/10 text-white shadow-[0_0_10px_rgba(167,139,250,0.2)]'
                    : 'border-white/5 bg-[#0A0F1D] text-[#9EACC4] hover:border-white/20'
                }`}
              >
                <span className="font-bold">L{st.layerIndex}</span>
                <span className="capitalize text-[10px]">({st.role})</span>
              </button>
            ))}
          </div>

          {/* Detailed inspection of the active step */}
          {walkthrough.steps[activeStepIndex] && (
            <div className="bg-[#0A0F1D] p-3 rounded-lg border border-white/5 space-y-3">
              <div className="flex justify-between items-center text-[11px] border-b border-white/5 pb-2">
                <span className="text-[#9EACC4] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-[#A78BFA]" />
                  Layer {walkthrough.steps[activeStepIndex].layerIndex} ({walkthrough.steps[activeStepIndex].role})
                </span>
                <span className="text-[#A78BFA] font-semibold">
                  Act: {walkthrough.steps[activeStepIndex].activationName || 'Identity'}
                </span>
              </div>

              {/* Input Vector */}
              <div className="space-y-1">
                <div className="text-[10px] text-[#9EACC4]">Inputs from previous stage (x):</div>
                <div className="flex gap-1.5 flex-wrap">
                  {walkthrough.steps[activeStepIndex].inputs.map((val, i) => (
                    <span key={i} className="px-2 py-0.5 rounded bg-white/5 text-white text-[11px]">
                      x<sub>{i}</sub>: {val.toFixed(3)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Pre-activations (z = Wx + b) */}
              {walkthrough.steps[activeStepIndex].preActivations && (
                <div className="space-y-1">
                  <div className="text-[10px] text-[#9EACC4]">Pre-activations (z = W·x + b):</div>
                  <div className="flex gap-1.5 flex-wrap">
                    {walkthrough.steps[activeStepIndex].preActivations.map((val, i) => (
                      <span key={i} className="px-2 py-0.5 rounded bg-[#46D7F2]/10 border border-[#46D7F2]/20 text-[#46D7F2] text-[11px]">
                        z<sub>{i}</sub>: {val.toFixed(3)}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Activations (a = sigma(z)) */}
              <div className="space-y-1">
                <div className="text-[10px] text-[#9EACC4]">Post-activations (a = &sigma;(z)):</div>
                <div className="flex gap-1.5 flex-wrap">
                  {walkthrough.steps[activeStepIndex].activations.map((val, i) => (
                    <span 
                      key={i} 
                      className={`px-2 py-0.5 rounded border text-[11px] ${
                        val === 0 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
                          : 'bg-[#3CD5AA]/10 border-[#3CD5AA]/20 text-[#3CD5AA]'
                      }`}
                    >
                      a<sub>{i}</sub>: {val.toFixed(3)} {val === 0 ? '(0)' : ''}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Final prediction summary */}
          <div className="p-2.5 rounded-lg bg-[#0A0F1D] border border-white/5 flex items-center justify-between text-[11px]">
            <span className="text-[#9EACC4]">Final Output Prediction:</span>
            <span className="text-white font-bold flex items-center gap-1">
              <Binary className="w-3.5 h-3.5 text-[#3CD5AA]" />
              {walkthrough.prediction.map(p => p.toFixed(4)).join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Tab: Architecture Topology */}
      {activeTab === 'topology' && topology && (
        <div className="space-y-3">
          <div className="space-y-2">
            {topology.layers.map((l, i) => (
              <div key={i} className="p-2.5 rounded-lg bg-[#0A0F1D] border border-white/5 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded bg-white/5 flex items-center justify-center font-bold text-[#A78BFA] text-[10px]">
                    {i}
                  </span>
                  <div>
                    <div className="font-semibold text-white text-[11px]">{l.type} Layer ({l.units} units)</div>
                    <div className="text-[10px] text-[#9EACC4]">
                      Activation: {l.activation || 'None'}
                    </div>
                  </div>
                </div>
                <div className="text-right text-[10px]">
                  <div className="text-white font-mono">{l.paramCount} parameters</div>
                  {l.weightCount > 0 && (
                    <div className="text-[#9EACC4]/60">
                      W: {l.inputDim}&times;{l.outputDim} + b: {l.outputDim}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="p-2 bg-[#0A0F1D] rounded border border-white/5 flex justify-between text-[11px]">
            <span className="text-[#9EACC4]">Total Trainable Parameters:</span>
            <span className="text-white font-bold">{topology.totalParameters}</span>
          </div>
        </div>
      )}

      {/* Tab: Gradient Check */}
      {activeTab === 'gradients' && (
        <div className="space-y-3">
          {gradientVerification ? (
            <>
              <div className="p-2.5 rounded-lg bg-[#0A0F1D] border border-white/5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Finite-Difference Gradient Verification</span>
                  {gradientVerification.isGradientValid ? (
                    <span className="flex items-center gap-1 text-[#3CD5AA] text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Verified Valid
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[#FF5C5C] text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5" /> Mismatch Exceeds Tolerance
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#9EACC4] leading-relaxed">
                  Compares backpropagation analytical gradients against two-sided numerical perturbations:
                  <br />
                  <code className="text-[#A78BFA]">&part;L/&part;&theta; &approx; (L(&theta; + &epsilon;) - L(&theta; - &epsilon;)) / 2&epsilon;</code>
                </p>
                <div className="flex justify-between text-[11px] pt-1 border-t border-white/5">
                  <span className="text-[#9EACC4]">Max Relative Difference:</span>
                  <span className="font-mono text-white">
                    {gradientVerification.maxRelativeDifference.toExponential(3)} (&lt; 1e-3)
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#9EACC4]">Loss at Test Point:</span>
                  <span className="font-mono text-white">
                    {gradientVerification.loss.toFixed(4)}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="p-4 text-center text-[#9EACC4] text-[11px]">
              Gradient checks require compatible weights and at most 256 parameters to keep the browser responsive.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
