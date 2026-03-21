import { _sb } from './supabaseClient.js';

// ── Mappers ──

export function leadToRow(l, businessId) {
  const row = {
    business_id:  businessId,
    name:         l.name         || null,
    address:      l.address      || null,
    phone:        l.phone        || null,
    email:        l.email        || null,
    category:     l.category     || null,
    lead_segment: l.lead_segment || null,
    ai_score:     l.ai_score     != null ? l.ai_score : null,
    ai_tags:      l.ai_tags      || [],
    ai_note:      l.ai_note      || null,
    status:       l.status       || 'new',
    source:       l.source       || null,
    notes:        l.notes        || [],
    owner_name:   l.owner_name   || null,
    updated_at:   new Date().toISOString(),
  };
  if (l.id) row.id = l.id;
  return row;
}

export function rowToLead(row) {
  return {
    id:             row.id,
    name:           row.name          || '',
    address:        row.address       || '',
    phone:          row.phone         || '',
    email:          row.email         || '',
    category:       row.category      || '',
    lead_segment:   row.lead_segment  || 'commercial',
    ai_score:       row.ai_score      || 0,
    ai_tags:        row.ai_tags       || [],
    ai_note:        row.ai_note       || '',
    business_blurb: row.ai_note       || '', // compatibility alias
    status:         row.status        || 'new',
    source:         row.source        || '',
    notes:          row.notes         || [],
    owner_name:     row.owner_name    || '',
    neighborhood:   row.neighborhood  || '',
    createdAt:      row.created_at    || null,
    updatedAt:      row.updated_at    || null,
  };
}

// ── Queries ──

export async function dbSaveLead(leadData, businessId) {
  const row = leadToRow(leadData, businessId);
  const { data, error } = await _sb
    .from('leads').upsert(row, { onConflict: 'id' }).select().single();
  if (error) { console.error('[CrewHub] dbSaveLead error:', error); throw error; }
  return rowToLead(data);
}

export async function dbDeleteLead(leadId) {
  const { error } = await _sb.from('leads').delete().eq('id', leadId);
  if (error) { console.error('[CrewHub] dbDeleteLead error:', error); throw error; }
}

export async function dbSaveLeadsBatch(leadsArray, businessId) {
  const rows = leadsArray.map(l => leadToRow(l, businessId));
  const { data, error } = await _sb
    .from('leads').upsert(rows, { onConflict: 'id' }).select();
  if (error) { console.error('[CrewHub] dbSaveLeadsBatch error:', error); throw error; }
  return (data || []).map(rowToLead);
}

export async function dbLoadAllLeads(businessId) {
  let query = _sb.from('leads').select('*');
  if (businessId) query = query.eq('business_id', businessId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) { console.error('[CrewHub] dbLoadAllLeads error:', error); return []; }
  return (data || []).map(rowToLead);
}
