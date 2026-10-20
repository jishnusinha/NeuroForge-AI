import { permutationImportance } from './permutationImportance.js';

// One worker per analysis. Termination cancels expensive kNN permutations
// without leaving stale results in the main React application.
self.onmessage = event => {
  const { requestId, matrix, model, options } = event.data ?? {};
  try {
    const result=permutationImportance(matrix,model,{
      ...options,
      onProgress:(completed,total)=>self.postMessage({requestId,type:'progress',completed,total}),
    });
    self.postMessage({requestId,type:'result',result});
  } catch (error) {
    self.postMessage({requestId,type:'error',message:error?.message??'Explanation failed.'});
  }
};
