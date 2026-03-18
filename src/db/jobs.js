import { _sb } from './supabaseClient.js';

// ── Mappers ──

export function jobToRow(q, businessId) {
  const row = {
    business_id:    businessId,
    customer_id:    q.customerId        || null,
    quote_num:      q.quoteNum          || null,
    name:           q.name              || null,
    address:        q.address           || null,
    phone:          q.phone             || null,
    email:          q.email             || null,
    contact:        q.contact           || null,
    company:        q.company           || null,
    type:           q.type              || null,
    std_count:      q.std        != null ? q.std   : null,
    large_count:    q.large      != null ? q.large : null,
    condition:      q.condition         || null,
    plan:           q.plan              || null,
    cleaning_side:  q.cleaningSide      || null,
    addons:         q.addons            || [],
    line_items:     q.lines             || [],
    subtotal:       q.subtotal   != null ? q.subtotal : null,
    tax_rate:       q.taxRate    != null ? q.taxRate  : null,
    grand_total:    q.grand      != null ? q.grand    : null,
    won:            q.won        != null ? q.won      : null,
    invoiced:       q.invoiced          || false,
    invoiced_date:  q.invoicedDate      || null,
    receipted:      q.receipted         || false,
    payment_method: q.paymentMethod     || null,
    review_pending: q.reviewPending     || false,
    review_sent:    q.reviewRequestSent || false,
    scheduled:      q.scheduled         || false,
    scheduled_iso:  q.scheduledISO      || null,
    scheduled_end:  q.scheduledEndISO   || null,
    scheduled_mins: q.scheduledMins     || null,
    assigned_to:    q.assignedTo        || null,
    assigned_team:  q.assignedTeam      || null,
    updated_at:     new Date().toISOString(),
  };
  if (q.id) row.id = q.id;
  return row;
}

export function rowToJob(row) {
  return {
    id:                row.id,
    customerId:        row.customer_id   || null,
    quoteNum:          row.quote_num     || null,
    name:              row.name          || '',
    address:           row.address       || '',
    phone:             row.phone         || '',
    email:             row.email         || '',
    contact:           row.contact       || '',
    company:           row.company       || '',
    type:              row.type          || 'Residential',
    std:               row.std_count     != null ? row.std_count   : 0,
    large:             row.large_count   != null ? row.large_count : 0,
    condition:         row.condition     || 'maintenance',
    plan:              row.plan          || 'oneoff',
    cleaningSide:      row.cleaning_side || 'outside',
    addons:            row.addons        || [],
    lines:             row.line_items    || [],
    subtotal:          parseFloat(row.subtotal)    || 0,
    taxRate:           parseFloat(row.tax_rate)    || 0,
    grand:             parseFloat(row.grand_total) || 0,
    won:               row.won           != null ? row.won : null,
    invoiced:          row.invoiced      || false,
    invoicedDate:      row.invoiced_date || null,
    receipted:         row.receipted     || false,
    paymentMethod:     row.payment_method || null,
    reviewPending:     row.review_pending || false,
    reviewRequestSent: row.review_sent   || false,
    scheduled:         row.scheduled     || false,
    scheduledISO:      row.scheduled_iso || null,
    scheduledEndISO:   row.scheduled_end || null,
    scheduledMins:     row.scheduled_mins || null,
    assignedTo:        row.assigned_to   || null,
    assignedTeam:      row.assigned_team || null,
    date:              row.created_at
      ? new Date(row.created_at).toLocaleDateString('en-CA', { day:'2-digit', month:'short', year:'2-digit' })
      : '',
    createdAt:         row.created_at    || null,
    updatedAt:         row.updated_at    || null,
  };
}

// ── Queries ──

export async function dbSaveJob(jobData, businessId) {
  const row = jobToRow(jobData, businessId);
  const { data, error } = await _sb
    .from('jobs').upsert(row, { onConflict: 'id' }).select().single();
  if (error) { console.error('[CrewHub] dbSaveJob error:', error); throw error; }
  return rowToJob(data);
}

export async function dbDeleteJob(jobId) {
  const { error } = await _sb.from('jobs').delete().eq('id', jobId);
  if (error) { console.error('[CrewHub] dbDeleteJob error:', error); throw error; }
}

export async function dbLoadAllJobs() {
  const { data, error } = await _sb
    .from('jobs').select('*').order('created_at', { ascending: false });
  if (error) { console.error('[CrewHub] dbLoadAllJobs error:', error); return []; }
  return (data || []).map(rowToJob);
}
