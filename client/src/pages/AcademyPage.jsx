import ChallengeHub from '../components/workspace/ChallengeHub.jsx';
import { summarizeLearningTracks, readAcademyProgress, writeAcademyProgress } from '../ml/learningPaths.js';
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
  const accountScope = typeof localStorage !== 'undefined' ? localStorage.getItem('neuroforge_account_id') : null;
  const [progress, setProgress] = useState(() => readAcademyProgress(localStorage, accountScope));
  const tracks = summarizeLearningTracks(progress);
  const { slug } = useParams();
  const { loadRun, setExperimentName } = useLabStore();
  const choices = {
    'lesson-xor': ['One straight line is sufficient', 'A hidden nonlinear representation is needed'],
    'lesson-lr': ['The updates can overshoot and diverge', 'Larger steps always converge faster'],
    'lesson-overfitting': ['The model necessarily generalizes well', 'Training and validation behavior suggest overfitting'],
    'lesson-leakage': ['Fit scaling separately on training, validation and test data', 'Fit preprocessing using training rows only, then transform held-out rows'],
    'lesson-imbalance': ['High overall accuracy guarantees good minority-class recall', 'Inspect class-specific errors and use a stratified split'],
    'lesson-counterfactual': ['A prediction-changing edit proves that intervention will work in reality', 'A model-based counterfactual is not a causal guarantee'],
  };
  const correct = { 'lesson-xor': 1, 'lesson-lr': 0, 'lesson-overfitting': 1,
    'lesson-leakage': 1, 'lesson-imbalance': 1, 'lesson-counterfactual': 1 };
  const answer = (id, index) => {
    setAnswers(prev => ({ ...prev, [id]: index }));
    if (index === correct[id]) {
      const next = { ...progress, [id]: true }; setProgress(next);
      try { writeAcademyProgress(localStorage,accountScope,next); } catch { /* Progress remains in this session. */ }
    }
  };
  const openLesson = id => {
    if (!['lesson-xor','lesson-lr'].includes(id)) return;
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
    {
      id:'lesson-leakage',track:'Evaluation & Trustworthy Data',
      title:'Why must preprocessing fit training data only?',
      question:'When computing a feature standardization mean, should the validation and test rows influence it?',
      explanation:'No. A mean, median, standard deviation, or scale estimated using validation/test samples leaks evaluation information into the model pipeline. Fit each transformation only on the training partition, then apply the unchanged fitted values to validation/test rows.',
      labLink:'/app/datasets',labLabel:'Inspect the CSV pipeline',
    },
    {
      id:'lesson-imbalance',track:'Evaluation & Trustworthy Data',
      title:'What can class imbalance conceal?',
      question:'A classifier reaches 95% overall accuracy when 95% of examples are class 0. Does the accuracy alone show that class 1 is detected?',
      explanation:'No. A majority-class-only classifier can achieve that accuracy while recovering zero minority examples. Examine the class distribution, stratified splits, confusion matrix, precision, recall, and minority-class errors before comparing models.',
      labLink:'/app/datasets',labLabel:'Investigate class balance',
    },
    {
      id:'lesson-counterfactual',track:'Explainability',
      title:'What does a model counterfactual really show?',
      question:'An input change flips a classifier prediction. Does that establish a feasible real-world intervention or causality?',
      explanation:'A counterfactual probe demonstrates how the fitted function responds at chosen inputs. Features can have causal dependencies, measurement constraints, and correlations. The nearest result within a bounded grid is not a global optimum or guaranteed intervention.',
      labLink:'/app/playground',labLabel:'Explore classifier predictions',
    },
  ];

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-200">
      <div className="border-b border-white/10 pb-5">
        <span className="text-xs font-mono uppercase tracking-wider text-quantum-mint">Predict-Before-Reveal Pedagogy</span>
        <h2 className="text-2xl font-display font-bold text-white mt-1">NeuroForge Academy</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Formulate a hypothesis before revealing the underlying mathematical proof, then jump directly into working lab experiments.
        </p>
      </div>

      <div className="space-y-6">
        <p className="text-sm text-quantum-mint">Checkpoints completed: {lessons.filter(lesson => progress[lesson.id]===true).length} / {lessons.length}</p>
        <div role="region" aria-label="Learning paths" className="grid gap-3 sm:grid-cols-3">
          {tracks.map(track=><div key={track.id} className="rounded-xl border border-white/10 bg-obsidian p-4">
            <h3 className="text-sm font-semibold text-white">{track.title}</h3>
            <p className="mt-2 text-xs text-text-muted">{track.completed} of {track.total} correctly answered checkpoints</p>
            <progress aria-label={track.title + ' progress'} value={track.completed} max={track.total} className="mt-2 w-full accent-emerald-400" />
            <p className="mt-2 text-xs text-quantum-mint">{track.finished?'Track checkpoints completed':'In progress'}</p>
          </div>)}
        </div>
        {lessons.filter(lesson => !slug || lesson.id === slug).map((lesson) => {
          const isRevealed = revealed[lesson.id];
          return (
            <div key={lesson.id} className="p-6 rounded-2xl bg-obsidian border border-white/10 shadow-md space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-mono text-neural-violet">{lesson.track}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-text-muted">Interactive Checkpoint</span>
              </div>

              <h3 className="text-lg font-display font-semibold text-white">{lesson.title}</h3>

              {/* Predict question */}
              <div className="p-4 rounded-xl bg-deep-space border border-white/5 text-xs text-text-primary space-y-2">
                <div className="flex items-center gap-2 text-plasma-cyan font-semibold">
                  <HelpCircle className="w-4 h-4" />
                  <span>Think & Predict:</span>
                </div>
                <p className="leading-relaxed">{lesson.question}</p>
              </div>

              {/* Reveal toggle button */}
              <fieldset className="space-y-2 text-sm"><legend className="text-xs text-text-muted">Choose your prediction</legend>
                {choices[lesson.id].map((choice, index) => <button key={choice} aria-pressed={answers[lesson.id] === index} onClick={() => answer(lesson.id, index)} className="block w-full text-left p-3 rounded border border-white/10 hover:border-cyan-300">{choice}</button>)}
                {answers[lesson.id] !== undefined && <p role="status">{answers[lesson.id] === correct[lesson.id] ? 'Correct. Checkpoint completed.' : 'Try again, then inspect the explanation.'}</p>}
              </fieldset>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <button
                  onClick={() => toggleReveal(lesson.id)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-white transition-colors"
                >
                  <Eye className="w-3.5 h-3.5 text-quantum-mint" />
                  <span>{isRevealed ? 'Hide Explanation' : 'Reveal Theory & Mathematical Proof'}</span>
                </button>

                <Link
                  to={lesson.labLink}
                  onClick={() => openLesson(lesson.id)}
                  className="flex items-center gap-1.5 text-xs font-medium text-plasma-cyan hover:underline"
                >
                  <span>{lesson.labLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Revealed Explanation */}
              {isRevealed && (
                <div className="p-4 rounded-xl bg-surface-dark border border-quantum-mint/30 text-xs text-text-muted leading-relaxed animate-in fade-in space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-quantum-mint">
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
