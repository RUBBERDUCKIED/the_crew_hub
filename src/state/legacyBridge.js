import useAppStore from './useAppStore.js';

// ─────────────────────────────────────────────────────────────
// Legacy Bridge — syncs legacy.js globals into the Zustand store.
// Called by legacy.js at key mutation points (after dbLoadAll,
// dbSaveJob, dbDeleteJob, afterSignIn, sbSignOut, etc.)
// ─────────────────────────────────────────────────────────────

export function syncAuthToStore(sbUser, businessId, memberId, role) {
  useAppStore.getState().setAuth(sbUser, businessId, memberId, role);
}

export function clearAuthInStore() {
  useAppStore.getState().clearAuth();
}

export function syncDataToStore(globals) {
  // globals = { savedQuotes, customers, crmNotes, leads, neighborhoods }
  // Only updates keys that are provided.
  // IMPORTANT: always spread objects/arrays into new references so Zustand's
  // shallow-equality check detects the change and triggers re-renders, even
  // when legacy mutates the same object in-place before calling this.
  const patch = {};
  if (globals.savedQuotes   !== undefined) patch.savedQuotes   = [...globals.savedQuotes];
  if (globals.customers     !== undefined) patch.customers     = { ...globals.customers };
  if (globals.crmNotes      !== undefined) patch.crmNotes      = { ...globals.crmNotes };
  if (globals.leads         !== undefined) patch.leads         = [...globals.leads];
  if (globals.neighborhoods !== undefined) patch.neighborhoods = [...globals.neighborhoods];
  if (Object.keys(patch).length > 0) {
    useAppStore.getState().setData(patch);
  }
}

export function syncAllToStore(globals) {
  // Full sync — auth + data. Called after afterSignIn completes.
  syncAuthToStore(globals.sbUser, globals.currentBusinessId, globals.currentMemberId, globals.currentUserRole);
  syncDataToStore(globals);
}
