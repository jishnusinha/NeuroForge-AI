// API Client for NeuroForge Experiments with local offline fallback

const API_BASE_URL = 'http://localhost:5000/api';

const LOCAL_STORAGE_KEY = 'neuroforge_saved_experiments';

function getLocalExperiments() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function saveLocalExperiments(list) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

export async function fetchExperiments() {
  try {
    const res = await fetch(`${API_BASE_URL}/experiments`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('API server returned error');
    const json = await res.json();
    return json.data || [];
  } catch (err) {
    console.info('Backend unreachable, using client local storage fallback.');
    return getLocalExperiments();
  }
}

export async function fetchExperimentById(id) {
  try {
    const res = await fetch(`${API_BASE_URL}/experiments/${id}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error('Experiment not found on server');
    const json = await res.json();
    return json.data;
  } catch (err) {
    const local = getLocalExperiments();
    return local.find((e) => e._id === id || e.shareId === id) || null;
  }
}

export async function createExperiment(payload) {
  // Always update local cache
  const localList = getLocalExperiments();
  const shareId = `rep-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const localRecord = {
    _id: `exp-${Date.now()}`,
    shareId,
    createdAt: new Date().toISOString(),
    ...payload,
  };
  saveLocalExperiments([localRecord, ...localList]);

  // Attempt server sync
  try {
    const res = await fetch(`${API_BASE_URL}/experiments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      const json = await res.json();
      return json.data;
    }
  } catch (err) {
    console.info('Saved experiment to local browser storage.');
  }

  return localRecord;
}

export async function removeExperiment(id) {
  const localList = getLocalExperiments();
  saveLocalExperiments(localList.filter((e) => e._id !== id && e.shareId !== id));

  try {
    await fetch(`${API_BASE_URL}/experiments/${id}`, {
      method: 'DELETE',
      signal: AbortSignal.timeout(3000),
    });
  } catch (e) {
    // Local deletion is already performed
  }
}
