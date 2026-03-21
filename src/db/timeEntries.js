import { _sb } from './supabaseClient.js';

export async function dbClockIn(memberId, businessId) {
  const existing = await dbGetActiveClockIn(memberId);
  if (existing) {
    console.warn('[CrewHub] Already clocked in, entry:', existing.id);
    return existing;
  }
  const { data, error } = await _sb
    .from('time_entries')
    .insert({
      business_id: businessId,
      member_id:   memberId,
      clock_in:    new Date().toISOString(),
      entry_type:  'shift',
    })
    .select().single();
  if (error) { console.error('[CrewHub] dbClockIn error:', error); throw error; }
  return data;
}

export async function dbClockOut(entryId) {
  const { data, error } = await _sb
    .from('time_entries')
    .update({ clock_out: new Date().toISOString() })
    .eq('id', entryId)
    .select().single();
  if (error) { console.error('[CrewHub] dbClockOut error:', error); throw error; }
  return data;
}

export async function dbGetActiveClockIn(memberId) {
  const { data, error } = await _sb
    .from('time_entries')
    .select('*')
    .eq('member_id', memberId)
    .is('clock_out', null)
    .eq('entry_type', 'shift')
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) { console.error('[CrewHub] dbGetActiveClockIn error:', error); return null; }
  return data || null;
}

export async function dbGetTimeEntries(memberId, startDate, endDate) {
  const { data, error } = await _sb
    .from('time_entries')
    .select('*')
    .eq('member_id', memberId)
    .gte('clock_in', startDate + 'T00:00:00')
    .lte('clock_in', endDate + 'T23:59:59')
    .eq('entry_type', 'shift')
    .order('clock_in', { ascending: true });
  if (error) { console.error('[CrewHub] dbGetTimeEntries error:', error); return []; }
  return data || [];
}

export async function dbUpdateBreakMins(entryId, breakMins, memberId) {
  const { data, error } = await _sb
    .from('time_entries')
    .update({ break_mins: breakMins, edited_by: memberId })
    .eq('id', entryId)
    .select().single();
  if (error) { console.error('[CrewHub] dbUpdateBreakMins error:', error); throw error; }
  return data;
}

export async function dbGetAllTimeEntries(startDate, endDate, businessId) {
  let query = _sb
    .from('time_entries')
    .select('*')
    .gte('clock_in', startDate + 'T00:00:00')
    .lte('clock_in', endDate + 'T23:59:59')
    .eq('entry_type', 'shift');
  if (businessId) query = query.eq('business_id', businessId);
  const { data, error } = await query.order('clock_in', { ascending: true });
  if (error) { console.error('[CrewHub] dbGetAllTimeEntries error:', error); return []; }
  return data || [];
}

export async function dbEditTimeEntry(entryId, updates, editorMemberId) {
  const patch = { ...updates, edited_by: editorMemberId };
  const { data, error } = await _sb
    .from('time_entries')
    .update(patch)
    .eq('id', entryId)
    .select().single();
  if (error) { console.error('[CrewHub] dbEditTimeEntry error:', error); throw error; }
  return data;
}

export async function dbAddManualTimeEntry(memberId, businessId, clockIn, clockOut, breakMins, editorMemberId) {
  const { data, error } = await _sb
    .from('time_entries')
    .insert({
      business_id: businessId,
      member_id:   memberId,
      clock_in:    clockIn,
      clock_out:   clockOut || null,
      break_mins:  breakMins || 0,
      entry_type:  'shift',
      edited_by:   editorMemberId,
    })
    .select().single();
  if (error) { console.error('[CrewHub] dbAddManualTimeEntry error:', error); throw error; }
  return data;
}

export async function dbGetAllActiveClockIns(businessId) {
  let query = _sb
    .from('time_entries')
    .select('*')
    .is('clock_out', null)
    .eq('entry_type', 'shift');
  if (businessId) query = query.eq('business_id', businessId);
  const { data, error } = await query;
  if (error) { console.error('[CrewHub] dbGetAllActiveClockIns error:', error); return []; }
  return data || [];
}
