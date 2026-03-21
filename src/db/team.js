import { _sb } from './supabaseClient.js';

export async function dbLoadTeamMembers(businessId) {
  let query = _sb.from('team_members').select('*');
  if (businessId) query = query.eq('business_id', businessId);
  const { data, error } = await query.order('created_at', { ascending: true });
  if (error) { console.error('[CrewHub] dbLoadTeamMembers error:', error); return []; }
  return (data || []).map(row => ({
    id:         row.id,
    name:       row.name,
    email:      row.email,
    role:       row.role,
    active:     row.active,
    createdAt:  row.created_at,
    authUserId: row.auth_user_id,
  }));
}

export async function dbAddTeamMember(name, email, role, businessId) {
  const { data, error } = await _sb
    .from('team_members')
    .insert({
      business_id:  businessId,
      auth_user_id: null,
      name,
      email: email.toLowerCase().trim(),
      role,
      active: true,
    })
    .select().single();
  if (error) { console.error('[CrewHub] dbAddTeamMember error:', error); throw error; }
  return data;
}

export async function dbUpdateTeamMember(memberId, updates) {
  const { data, error } = await _sb
    .from('team_members')
    .update(updates)
    .eq('id', memberId)
    .select().single();
  if (error) { console.error('[CrewHub] dbUpdateTeamMember error:', error); throw error; }
  return data;
}

export async function dbRemoveTeamMember(memberId) {
  const { error } = await _sb
    .from('team_members')
    .delete()
    .eq('id', memberId);
  if (error) { console.error('[CrewHub] dbRemoveTeamMember error:', error); throw error; }
}

export async function dbLoadBusinessInfo(businessId) {
  if (!businessId) { console.warn('[CrewHub] dbLoadBusinessInfo called without businessId'); return null; }
  // Use .limit(1) instead of .single() to avoid errors with RLS edge cases
  const { data, error } = await _sb
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .limit(1);
  if (error) { console.error('[CrewHub] dbLoadBusinessInfo error:', error, 'businessId:', businessId); return null; }
  return data?.[0] || null;
}

export async function dbUpdateBusiness(updates, businessId) {
  if (!businessId) return null;
  const { error } = await _sb
    .from('businesses')
    .update(updates)
    .eq('id', businessId);
  if (error) { console.error('[CrewHub] dbUpdateBusiness error:', error, 'businessId:', businessId); throw error; }
  // Re-fetch to return updated data (use .limit(1) instead of .single() for RLS resilience)
  const { data } = await _sb
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .limit(1);
  return data?.[0] || null;
}

export async function dbUploadLogo(file, businessId) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${businessId}/logo.${ext}`;
  const { error: uploadError } = await _sb.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) { console.error('[CrewHub] dbUploadLogo upload error:', uploadError); throw uploadError; }
  const { data } = _sb.storage.from('logos').getPublicUrl(path);
  // Store URL with cache-bust so CDN/email clients always fetch the latest version
  const publicUrl = data.publicUrl + '?t=' + Date.now();
  await _sb.from('businesses').update({ logo_url: publicUrl }).eq('id', businessId);
  return publicUrl;
}

export async function dbRemoveLogo(businessId) {
  await _sb.from('businesses').update({ logo_url: null }).eq('id', businessId);
}

export async function dbMarkOnboardingComplete(memberId) {
  if (!memberId) { console.warn('[CrewHub] dbMarkOnboardingComplete: no memberId'); return; }
  const { error, count } = await _sb
    .from('team_members')
    .update({ onboarding_completed: true })
    .eq('id', memberId);
  if (error) {
    console.error('[CrewHub] dbMarkOnboardingComplete error:', error, 'memberId:', memberId);
    // Fallback: try via localStorage so onboarding doesn't repeat even if DB fails
    try { localStorage.setItem('twc_onboarding_done_' + memberId, 'true'); } catch(_e) {}
  } else {
    console.info('[CrewHub] Onboarding marked complete for member:', memberId, 'rows:', count);
    try { localStorage.setItem('twc_onboarding_done_' + memberId, 'true'); } catch(_e) {}
  }
}
