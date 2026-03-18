import { _sb } from './supabaseClient.js';

// ── Mappers ──

export function customerToRow(c, businessId) {
  const row = {
    business_id:       businessId,
    name:              c.name            || '',
    address:           c.address         || null,
    phone:             c.phone           || null,
    email:             c.email           || null,
    contact:           c.contact         || null,
    company:           c.company         || null,
    lead_source:       c.leadSource      || null,
    tags:              c.tags            || [],
    last_contact_date: c.lastContactDate || null,
    archived:          c.archived        || false,
    updated_at:        new Date().toISOString(),
  };
  if (c.customerId) row.id = c.customerId;
  if (c.createdAt)  row.created_at = c.createdAt;
  return row;
}

export function rowToCustomer(row) {
  return {
    customerId:      row.id,
    name:            row.name             || '',
    address:         row.address          || '',
    phone:           row.phone            || '',
    email:           row.email            || '',
    contact:         row.contact          || '',
    company:         row.company          || '',
    leadSource:      row.lead_source      || '',
    tags:            row.tags             || [],
    lastContactDate: row.last_contact_date || null,
    archived:        row.archived         || false,
    createdAt:       row.created_at       || null,
    updatedAt:       row.updated_at       || null,
  };
}

// ── Queries ──

export async function dbSaveCustomer(customerData, businessId) {
  const row = customerToRow(customerData, businessId);
  const { data, error } = await _sb
    .from('customers').upsert(row, { onConflict: 'id' }).select().single();
  if (error) { console.error('[CrewHub] dbSaveCustomer error:', error); throw error; }
  return rowToCustomer(data);
}

export async function dbDeleteCustomer(customerId) {
  const { error } = await _sb.from('customers').delete().eq('id', customerId);
  if (error) { console.error('[CrewHub] dbDeleteCustomer error:', error); throw error; }
}

export async function dbLoadAllCustomers() {
  const { data, error } = await _sb.from('customers').select('*');
  if (error) { console.error('[CrewHub] dbLoadAllCustomers error:', error); return []; }
  return (data || []).map(rowToCustomer);
}
