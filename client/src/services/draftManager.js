import { saveDraftLocal, getDraftLocal, saveRecoverySession, getRecoverySession, clearRecoverySession, enqueueOutboxOperation, getSnapshotLocal } from './localRepository.js';

export class DraftManager {
  constructor(channel = null) {
    this.tabId = crypto.randomUUID(); this.channel = channel; this.listeners = new Set();
    this.currentDraft = null; this.status = 'pristine'; this.lastSavedAt = null; this.lastError = null;
    this.debounceTimer = null; this.serial = Promise.resolve(); this.bases = new Map(); this.executionState = 'idle';
    if (channel) channel.onmessage = event => this.handleBroadcastMessage(event.data);
  }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  notify() { this.listeners.forEach(fn => fn({ status: this.status, lastSavedAt: this.lastSavedAt, lastError: this.lastError, currentDraft: this.currentDraft })); }
  handleBroadcastMessage(data) {
    if (data?.type === 'DRAFT_SAVED' && data.tabId !== this.tabId && data.draftId === this.currentDraft?.id && data.revision > (this.bases.get(data.draftId) ?? 0)) {
      clearTimeout(this.debounceTimer); this.status = 'conflict'; this.lastError = 'Another tab changed this draft. Reload or duplicate before saving.'; this.notify();
    }
  }
  queueAutosave(draft, delayMs = 600) {
    if (!draft?.id) return;
    if (this.currentDraft && this.currentDraft.id !== draft.id && this.status === 'pending') this.saveNow().catch(() => {});
    if (this.currentDraft?.id !== draft.id) this.status = 'pristine';
    this.currentDraft = { ...structuredClone(draft), ownerScope: typeof localStorage !== 'undefined' ? localStorage.getItem('neuroforge_account_id') || 'guest' : 'guest' };
    if (this.status === 'conflict') return;
    this.status = 'pending'; this.notify(); clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.saveNow().catch(() => {}), delayMs);
  }
  saveNow() {
    clearTimeout(this.debounceTimer); this.debounceTimer = null;
    if (!this.currentDraft) return Promise.resolve(null);
    if (this.status === 'conflict') return Promise.reject(new Error('REVISION_CONFLICT'));
    const draft = structuredClone(this.currentDraft);
    const task = async () => {
      this.status = 'saving'; this.notify();
      try {
        if (!this.bases.has(draft.id)) this.bases.set(draft.id, draft.baseRevision ?? (await getDraftLocal(draft.id))?.revision ?? 0);
        const expectedRevision = this.bases.get(draft.id);
        const existing = await getDraftLocal(draft.id);
        if (existing?.revision === expectedRevision && JSON.stringify(existing.configuration) === JSON.stringify(draft.configuration)) {
          await saveRecoverySession({draftId:draft.id,workspace:draft.workspace,configuration:draft.configuration,revision:existing.revision,executionState:this.executionState});
          this.status='saved_local';this.lastSavedAt=existing.updatedAt;this.lastError=null;this.notify();
          return {success:true,id:draft.id,revision:existing.revision,at:existing.updatedAt};
        }
        const result = await saveDraftLocal({ ...draft, expectedRevision, clientTabId: this.tabId });
        this.bases.set(draft.id, result.revision);
        await saveRecoverySession({ draftId: draft.id, workspace: draft.workspace, configuration: draft.configuration, revision: result.revision, executionState: this.executionState });
        const ownerScope = typeof localStorage !== 'undefined' ? localStorage.getItem('neuroforge_account_id') || 'guest' : 'guest';
        const cloud = await getSnapshotLocal('cloud-revision:' + ownerScope + ':' + draft.id);
        await enqueueOutboxOperation('SYNC_DRAFT', { draftId: draft.id, clientTabId: this.tabId, expectedRevision: cloud?.revision ?? 0, localRevision: result.revision, configuration: draft.configuration });
        this.lastSavedAt = result.at; this.lastError = null;
        if (this.currentDraft?.id === draft.id && JSON.stringify(this.currentDraft.configuration) === JSON.stringify(draft.configuration)) this.status = 'saved_local';
        else this.status = 'pending';
        this.channel?.postMessage({ type: 'DRAFT_SAVED', draftId: draft.id, revision: result.revision, tabId: this.tabId });
        this.notify(); return result;
      } catch (error) {
        this.status = error.code === 'REVISION_CONFLICT' ? 'conflict' : 'failed'; this.lastError = error.message; this.notify(); throw error;
      }
    };
    const result = this.serial.then(task); this.serial = result.catch(() => {}); return result;
  }
  async resolveConflict(action) {
    if (!this.currentDraft) return null;
    if (action === 'duplicate') {
      this.currentDraft = { ...this.currentDraft, id: crypto.randomUUID(), baseRevision: 0 }; this.status = 'pending'; const result=await this.saveNow(); this.currentDraft={...this.currentDraft,revision:result.revision,baseRevision:result.revision}; return this.currentDraft;
    }
    const latest = await getDraftLocal(this.currentDraft.id);
    if (!latest) throw new Error('Draft no longer exists.');
    this.bases.set(latest.id, latest.revision); this.currentDraft = latest; this.status = 'saved_local'; this.notify(); return latest;
  }
  async setExecutionState(state) {
    this.executionState = state;
    const session = await getRecoverySession();
    if (session && session.draftId === this.currentDraft?.id) await saveRecoverySession({ ...session, executionState: state });
  }
  async checkRecoveryOnStartup() {
    const session = await getRecoverySession();
    if (!session) return { hasRecovery: false };
    let draft = await getDraftLocal(session.draftId);
    const legacyIncomplete = Boolean(draft && !Array.isArray(draft.configuration?.dataset?.points));
    if (legacyIncomplete) {
      const old = draft.configuration || {};
      const studio = draft.workspace === 'studio';
      draft = { ...draft, id:crypto.randomUUID(), revision:0, configuration:{workspace:draft.workspace,algorithm:old.selectedAlgorithm || 'Logistic Regression',dataset:{name:studio?'XOR Problem':'Two Moons',noise: studio ? 0.12 : 0.2,trainRatio:.8},hyperparameters:studio?{layers:old.layers,learningRate:old.learningRate,optimizer:old.optimizer,batchSize:old.batchSize}:{learningRate:old.learningRate,regularization:old.regularization,threshold:old.threshold,k:old.knnK}} };
    }
    return { hasRecovery: Boolean(draft), wasInterrupted: ['running','validating','stopping'].includes(session.executionState), session, draft, legacyIncomplete };
  }
  async dismissRecovery() { await clearRecoverySession(); }
}
let channel = null;
if (typeof window !== 'undefined' && window.BroadcastChannel) channel = new window.BroadcastChannel('neuroforge_draft_channel');
export const draftManager = new DraftManager(channel);
