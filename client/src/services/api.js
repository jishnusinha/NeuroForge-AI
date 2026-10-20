import { toDomain, adaptRecord } from '../../../shared/domain.mjs';
const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api';
const KEY = 'neuroforge_saved_experiments';
const cacheKey = () => localStorage.getItem('neuroforge_account_id') ? KEY + '_' + localStorage.getItem('neuroforge_account_id') : KEY;
function read() {
  try { const list = JSON.parse(localStorage.getItem(cacheKey()) || '[]'); return Array.isArray(list) ? list : []; }
  catch { return []; }
}
function write(list) { localStorage.setItem(cacheKey(), JSON.stringify(list)); }
function headers() {
  let token = localStorage.getItem('neuroforge_owner_token');
  if (!token) { token = crypto.randomUUID(); localStorage.setItem('neuroforge_owner_token', token); }
  const session = localStorage.getItem('neuroforge_session_token');
  return { 'Content-Type': 'application/json', 'X-Owner-Token': token, ...(session ? { Authorization: 'Bearer ' + session } : {}) };
}
export async function request(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers: headers(), signal: AbortSignal.timeout(path.startsWith('/v2/auth/') ? 15000 : 5000) });
  if (!response.ok) {
    let body = {};
    try { body = await response.json(); } catch { /* Some proxies return non-JSON errors. */ }
    const error = new Error(`${body.error || 'Request failed'} (${response.status})`);
    error.status = response.status; error.code = body.code;
    throw error;
  }
  return response.json();
}
export async function fetchExperiments() {
  try {
    const server = (await request('/experiments')).data || [];
    const merged = [...server, ...read().filter(local => !server.some(run => run.shareId === local.shareId))];
    try { write(merged); } catch { /* Server data remains available. */ }
    return Promise.all(merged.map(adaptRecord));
  } catch { return Promise.all(read().map(adaptRecord)); }
}
export async function fetchExperimentById(id) {
  const local=read().find(run=>run.storage==='local'&&(run._id===id||run.shareId===id));
  if(local)return adaptRecord(local);
  try { return adaptRecord((await request(id.startsWith('share-') ? '/v2/shares/' + encodeURIComponent(id) : '/experiments/' + encodeURIComponent(id))).data); }
  catch (error) { if (error.status || id.startsWith('share-')) return null; return adaptRecord(read().find(run => run._id === id || run.shareId === id) || null); }
}
export async function createExperiment(payload) {
  const record = { ...payload, _id: `local-${crypto.randomUUID()}`, shareId: `rep-${crypto.randomUUID()}`, createdAt: new Date().toISOString(), storage: 'local' };
  record.runId = payload.runId || crypto.randomUUID();
  record.schemaVersion = 2;
  record.domain = await toDomain(record, { legacy: false, membership: payload.evaluation?.membership ?? null, splitSeed: payload.evaluation?.splitSeed ?? null, parentRunId: payload.parentRunId ?? null });
  let saved;
  try { saved = (await request('/experiments', { method: 'POST', body: JSON.stringify(record) })).data; }
  catch (error) { if (error.status) throw error; }
  if (saved) {
    try { write([saved, ...read().filter(run => run.shareId !== saved.shareId)]); } catch { /* Server save succeeded. */ }
    return saved;
  }
  write([record, ...read()]);
  return record;
}
export async function removeExperiment(id) {
  const list = read();
  const record = list.find(run => run._id === id || run.shareId === id);
  if (record?.storage !== 'local') await request(`/experiments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  write(list.filter(run => run._id !== id && run.shareId !== id));
}

export async function authenticate(mode, credentials) {
  const result = await request('/v2/auth/'+mode,{method:'POST',body:JSON.stringify(credentials)});
  if(result.verificationRequired)return null;
  localStorage.setItem('neuroforge_session_token',result.token); localStorage.setItem('neuroforge_account_id',result.user.id);
  return result.user;
}
export async function logout() { await request('/v2/auth/logout',{method:'POST'}); localStorage.removeItem('neuroforge_session_token'); localStorage.removeItem('neuroforge_account_id'); }
export const createShare = (resourceId, resourceType='run', expiresInHours=168) => request('/v2/shares',{method:'POST',body:JSON.stringify({resourceId,resourceType,expiresInHours})});
export const revokeShare = shareId => request('/v2/shares/'+encodeURIComponent(shareId),{method:'DELETE'});
