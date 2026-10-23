import {useState} from 'react';

const readStore=key=>{try{return JSON.parse(localStorage.getItem(key)||'{}');}catch{return {};}};
export default function AcademyCheckpoint({spec}){
 const [answers,setAnswers]=useState(()=>readStore('neuroforge_academy_checkpoint_answers_v1'));
 const [notes,setNotes]=useState(()=>readStore('neuroforge_academy_checkpoint_notes_v1'));
 const answer=answers[spec.id],correct=Number(answer)===spec.checkpoint.answer;
 const choose=index=>{const next={...answers,[spec.id]:index};setAnswers(next);try{localStorage.setItem('neuroforge_academy_checkpoint_answers_v1',JSON.stringify(next));}catch{/* Progress remains available in this page. */}};
 const saveNote=value=>{const next={...notes,[spec.id]:value.slice(0,4000)};setNotes(next);try{localStorage.setItem('neuroforge_academy_checkpoint_notes_v1',JSON.stringify(next));}catch{/* Note remains available in this page. */}};
 return <section className="rounded-2xl border border-white/10 bg-surface-dark p-4" aria-labelledby="academy-checkpoint-title">
  <h2 id="academy-checkpoint-title" className="font-semibold">Case checkpoint</h2>
  <p className="mt-2 text-sm">{spec.checkpoint.question}</p>
  <fieldset className="mt-3 space-y-2"><legend className="sr-only">Choose one answer</legend>{spec.checkpoint.choices.map((choice,index)=><label key={choice} className="flex items-start gap-2 text-sm"><input type="radio" name={`checkpoint-${spec.id}`} checked={Number(answer)===index} onChange={()=>choose(index)}/><span>{choice}</span></label>)}</fieldset>
  {answer!==undefined&&<p role="status" className="mt-3 text-sm">{correct?spec.checkpoint.why:'Review the explanation and try again.'}</p>}
  <label className="mt-4 block text-sm">Learning note<textarea aria-label="Case learning note" value={notes[spec.id]||''} onChange={event=>saveNote(event.target.value)} rows="3" className="mt-1 block w-full rounded-lg border border-white/20 bg-obsidian p-2" placeholder="Record an observation or question for later."/></label>
 </section>;
}
