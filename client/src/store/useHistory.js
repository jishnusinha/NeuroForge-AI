import { useCallback, useReducer } from 'react';
export function useHistory(initial) {
  const [history, dispatch] = useReducer((h, action) => {
    if (action.type === 'undo') return h.past.length ? {past:h.past.slice(0,-1),present:h.past.at(-1),future:[h.present,...h.future]} : h;
    if (action.type === 'redo') return h.future.length ? {past:[...h.past,h.present],present:h.future[0],future:h.future.slice(1)} : h;
    const next = typeof action.update === 'function' ? action.update(h.present) : action.update;
    return Object.is(next,h.present) ? h : {past:[...h.past,h.present].slice(-50),present:next,future:[]};
  }, initial, value => ({past:[],present:typeof value === 'function' ? value() : value,future:[]}));
  const setValue = useCallback(update => dispatch({type:'set',update}),[]);
  const undo = useCallback(() => dispatch({type:'undo'}),[]);
  const redo = useCallback(() => dispatch({type:'redo'}),[]);
  return [history.present,setValue,undo,redo,history.past.length>0,history.future.length>0];
}
