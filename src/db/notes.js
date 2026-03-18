import { _sb } from './supabaseClient.js';

// ── Mappers ──

function _formatNoteDate(isoStr) {
  return new Date(isoStr).toLocaleDateString('en-CA', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export function noteToRow(n, customerId, businessId, memberId) {
  return {
    business_id: businessId,
    customer_id: customerId,
    text:        n.text,
    created_by:  memberId || null,
    created_at:  new Date().toISOString(),
  };
}

export function rowToNote(row) {
  return {
    id:   row.id,
    text: row.text,
    date: _formatNoteDate(row.created_at),
  };
}

// ── Queries ──

export async function dbSaveNote(customerId, text, businessId, memberId) {
  const { data, error } = await _sb
    .from('notes')
    .insert({ business_id: businessId, customer_id: customerId, text, created_by: memberId || null })
    .select().single();
  if (error) { console.error('[CrewHub] dbSaveNote error:', error); throw error; }
  return rowToNote(data);
}

export async function dbDeleteNote(noteId) {
  const { error } = await _sb.from('notes').delete().eq('id', noteId);
  if (error) { console.error('[CrewHub] dbDeleteNote error:', error); throw error; }
}

// Returns raw rows so the dbLoadAll wrapper can group them by customer_id
export async function dbLoadAllNotes() {
  const { data, error } = await _sb
    .from('notes').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[CrewHub] dbLoadAllNotes error:', error); return []; }
  return data || [];
}
