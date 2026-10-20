import ChallengeHub from '../components/workspace/ChallengeHub.jsx';
import { useLabStore } from '../store/useLabStore.js';
import { isFeatureEnabled } from '../services/productionConfig.js';
import React, { useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { generateXOR, generateLinearTrend } from '../ml/datasets';
import { HelpCircle, Eye, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function AcademyPage() {
  const activeRun = useLabStore(state=>state.activeRun || state.savedRun);

  const [revealed, setRevealed] = useState({});
  const [answers, setAnswers] = useState({});
  const [progress, setProgress] = useState(() => {
    try { return JSON.parse(localStorage.getItem('neuroforge_learning_progress') || '{}'); } catch { return {}; }
  });
  const { slug } = useParams();
  const { loadRun, setExperimentName } = useLabStore();
  const choices = {
    'lesson-xor': ['One straight line is sufficient', 'A hidden nonlinear representation is needed'],
    'lesson-lr': ['The updates can overshoot and diverge', 'Larger steps always converge faster'],
    'lesson-overfitting': ['The model necessarily generalizes well', 'Training and validation behavior suggest overfitting'],
  };
  const correct = { 'lesson-xor': 1, 'lesson-lr': 0, 'lesson-overfitting': 1 };
  const answer = (id, index) => {
    setAnswers(prev => ({ ...prev, [id]: index }));
    if (index === correct[id]) {
      const next = { ...progress, [id]: true }; setProgress(next);
      try { localStorage.setItem('neuroforge_learning_progress', JSON.stringify(next)); } catch { /* Progress remains in this session. */ }
    }
  };
  const openLesson = id => {
    if (id === 'lesson-overfitting') return;
    const xor = id === 'lesson-xor';
    loadRun({ workspace: xor ? 'studio' : 'playground', algorithm: xor ? 'Dense MLP (2-4-1)' : 'Linear Regression',
      dataset: { name: xor ? 'XOR Problem' : 'Linear Trend', points: xor ? generateXOR(180,.12,42) : generateLinearTrend(120,.25,42), noise: xor ? .12 : .25, trainRatio:.8, seed:42 },
      hyperparameters: xor ? {layers:[{id:'in',type:'Input',units:2,activation:'Linear'},{id:'hidden',type:'Dense',units:4,activation:'ReLU'},{id:'out',type:'Output',units:1,activation:'Sigmoid'}],learningRate:.04,epochs:60} : {method:'gd',learningRate:.08} });
    setExperimentName(xor ? 'Hidden layer challenge' : 'Learning rate investigation');
  };

  const toggleReveal = (id) => {
    setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const lessons = [
    {
      id: 'lesson-xor',
      track: 'Deep Learning Foundations',
      title: 'Why do neural networks need hidden layers?',
      question: 'Suppose you have a 2D dataset where class A is at (0,0) and (1,1), while class B is at (0,1) and (1,0). Can any single straight line cleanly separate them?',
      explanation: 'No! The two classes form an XOR pattern where diagonally opposed points share the same label. A single linear layer computes a single straight line (hyperplane) w₁x₁ + w₂x₂ + b = 0. Adding a hidden layer transforms the original coordinate space non-linearly, enabling the output neuron to separate the transformed representations cleanly.',
      labLink: '/app/studio',
      labLabel: 'Open XOR in Neural Studio',
    },
    {
      id: 'lesson-lr',
      track: 'Optimization',
      title: 'What happens when your learning rate is too high?',
      question: 'When performing gradient descent on a steep quadratic loss bowl, what occurs if the step size (learning rate α) exceeds 2 / L where L is the Lipschitz smoothness constant?',
      explanation: 'The parameter updates will overshoot the minimum and oscillate outwards with increasing amplitude, causing the loss function to explode to infinity (NaN / non-finite gradient divergence).',
      labLink: '/app/playground',
      labLabel: 'Test Learning Rate in Playground',
    },
    {
      id: 'lesson-overfitting',
      track: 'Generalization & Evaluation',
      title: 'How do you detect overfitting in an experiment?',
      question: 'If your model achieves 99.8% training accuracy but only 72% validation accuracy while validation loss starts rising after epoch 30, what has happened?',
      explanation: 'The model has overfitted. It has memorized the random noise and idiosyncrasies in the training sample rather than learning the underlying probability distribution. The divergence between train loss and val loss is the empirical indicator of this failure mode.',
      labLink: '/app/arena',
      labLabel: 'Inspect Overfitting in Arena',
    },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-white/10 pb-5">
        <span className="text-xs font-mono uppercase tracking-wider text-[#3CD5AA]">Predict-Before-Reveal Pedagogy</span>
        <h2 className="text-2xl font-display font-bold text-white mt-1">NeuroForge Academy</h2>
        <p className="text-xs text-[#9EACC4] mt-0.5">
          Formulate a hypothesis before revealing the underlying mathematical proof, then jump directly into working lab experiments.
        </p>
      </div>

      <div className="space-y-6">
        <p className="text-sm text-[#3CD5AA]">Checkpoints completed: {Object.values(progress).filter(Boolean).length} / {lessons.length}</p>
        {lessons.filter(lesson => !slug || lesson.id === slug).map((lesson) => {
          const isRevealed = revealed[lesson.id];
          return (
            <div key={lesson.id} className="p-6 rounded-2xl bg-[#151E30] border border-white/10 shadow-md space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-[#A78BFA]">{lesson.track}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-[#9EACC4]">Interactive Checkpoint</span>
              </div>

              <h3 className="text-lg font-display font-semibold text-white">{lesson.title}</h3>

              {/* Predict question */}
              <div className="p-4 rounded-xl bg-[#080D18] border border-white/5 text-xs text-[#F2F5FC] space-y-2">
                <div className="flex items-center gap-2 text-[#46D7F2] font-semibold">
                  <HelpCircle className="w-4 h-4" />
                  <span>Think & Predict:</span>
                </div>
                <p className="leading-relaxed">{lesson.question}</p>
              </div>

              {/* Reveal toggle button */}
              <fieldset className="space-y-2 text-sm"><legend className="text-xs text-[#9EACC4]">Choose your prediction</legend>
                {choices[lesson.id].map((choice, index) => <button key={choice} aria-pressed={answers[lesson.id] === index} onClick={() => answer(lesson.id, index)} className="block w-full text-left p-3 rounded border border-white/10 hover:border-cyan-300">{choice}</button>)}
                {answers[lesson.id] !== undefined && <p role="status">{answers[lesson.id] === correct[lesson.id] ? 'Correct. Checkpoint completed.' : 'Try again, then inspect the explanation.'}</p>}
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => toggleReveal(lesson.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-[#3CD5AA]" />
                  <span>{isRevealed ? 'Hide Explanation' : 'Reveal Theory & Mathematical Proof'}</span>
                </button>

                <Link
                  to={lesson.labLink}
                  onClick={() => openLesson(lesson.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-[#46D7F2] hover:underline"
                >
                  <span>{lesson.labLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Revealed Explanation */}
              {isRevealed && (
                <div className="p-4 rounded-xl bg-[#0D1422] border border-[#3CD5AA]/30 text-xs text-[#9EACC4] leading-relaxed animate-in fade-in space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#3CD5AA]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Scientific Proof & Explanation:</span>
                  </div>
                  <p>{lesson.explanation}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    {isFeatureEnabled('investigation_academy') && <ChallengeHub activeRun={activeRun}/>}</div>
  );
}
