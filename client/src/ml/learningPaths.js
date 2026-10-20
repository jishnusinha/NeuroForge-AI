export const LEARNING_TRACKS = Object.freeze([
  {id:'model-basics',title:'Model foundations',lessonIds:['lesson-xor','lesson-lr']},
  {id:'evaluation',title:'Evaluation & trustworthy data',lessonIds:['lesson-overfitting','lesson-leakage','lesson-imbalance']},
  {id:'explainability',title:'Explainability',lessonIds:['lesson-counterfactual']},
]);

export function summarizeLearningTracks(progress, tracks=LEARNING_TRACKS) {
  return tracks.map(track=>{
    const completed=track.lessonIds.filter(id=>progress?.[id]===true).length;
    return {...track,completed,total:track.lessonIds.length,finished:completed===track.lessonIds.length};
  });
}

export function academyStorageKey(accountId) {
  return accountId ? 'neuroforge_learning_progress:'+String(accountId) : 'neuroforge_learning_progress';
}
export function readAcademyProgress(storage, accountId) {
  try {
    const progress=JSON.parse(storage.getItem(academyStorageKey(accountId))||'{}');
    return progress && typeof progress==='object' && !Array.isArray(progress) ? progress : {};
  }catch{return {};}
}
export function writeAcademyProgress(storage,accountId,progress) {
  storage.setItem(academyStorageKey(accountId),JSON.stringify(progress));
}
