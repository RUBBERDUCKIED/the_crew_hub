import { create } from 'zustand';

// ─────────────────────────────────────────────────────────────
// Zustand store — single source of truth for React components.
// Legacy code in legacy.js still uses its own globals, but calls
// syncToStore() at key mutation points to keep this store current.
// React components subscribe to this store via useAppStore().
// ─────────────────────────────────────────────────────────────

const useAppStore = create((set, get) => ({

  // ── Auth & Identity ──
  sbUser:            null,
  currentBusinessId: null,
  currentMemberId:   null,
  currentUserRole:   'owner',
  isSignedIn:        false,

  // ── Core Data ──
  savedQuotes:   [],
  customers:     {},    // keyed by customerId
  crmNotes:      {},    // keyed by customerId
  leads:         [],
  neighborhoods: [],

  // ── UI State ──
  activeTab:  'today',
  isSyncing:  false,

  // ── Actions: called by legacy bridge or directly by React components ──

  setAuth: (sbUser, businessId, memberId, role) => set({
    sbUser,
    currentBusinessId: businessId,
    currentMemberId:   memberId,
    currentUserRole:   role || 'owner',
    isSignedIn:        !!sbUser,
  }),

  clearAuth: () => set({
    sbUser:            null,
    currentBusinessId: null,
    currentMemberId:   null,
    currentUserRole:   'owner',
    isSignedIn:        false,
  }),

  setData: (data) => set(data),
  // Usage: setData({ savedQuotes: [...], customers: {...} })
  // Accepts any subset of state keys

  setActiveTab: (tab) => set({ activeTab: tab }),

  setSyncing: (val) => set({ isSyncing: val }),

  // ── Granular updaters (for Phase 6+ React components) ──

  updateJob: (job) => {
    const quotes = [...get().savedQuotes];
    const idx = quotes.findIndex(q => q.id === job.id);
    if (idx !== -1) quotes[idx] = job;
    else quotes.unshift(job);
    set({ savedQuotes: quotes });
  },

  removeJob: (jobId) => {
    set({ savedQuotes: get().savedQuotes.filter(q => q.id !== jobId) });
  },

  updateCustomer: (customer) => {
    const custs = { ...get().customers };
    custs[customer.customerId] = customer;
    set({ customers: custs });
  },

  removeCustomer: (customerId) => {
    const custs  = { ...get().customers };
    const notes  = { ...get().crmNotes };
    delete custs[customerId];
    delete notes[customerId];
    set({ customers: custs, crmNotes: notes });
  },

  addNote: (customerId, note) => {
    const notes = { ...get().crmNotes };
    if (!notes[customerId]) notes[customerId] = [];
    notes[customerId] = [note, ...notes[customerId]];
    set({ crmNotes: notes });
  },

  removeNote: (customerId, noteId) => {
    const notes = { ...get().crmNotes };
    if (notes[customerId]) {
      notes[customerId] = notes[customerId].filter(n => n.id !== noteId);
    }
    set({ crmNotes: notes });
  },

  updateLead: (lead) => {
    const list = [...get().leads];
    const idx  = list.findIndex(l => l.id === lead.id);
    if (idx !== -1) list[idx] = lead;
    else list.push(lead);
    set({ leads: list });
  },

  removeLead: (leadId) => {
    set({ leads: get().leads.filter(l => l.id !== leadId) });
  },

}));

export default useAppStore;
