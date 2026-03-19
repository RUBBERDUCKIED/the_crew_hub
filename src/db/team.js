import { _sb } from './supabaseClient.js';

export async function dbLoadTeamMembers() {
  const { data, error } = await _sb
    .from('team_members')
    .select('*')
    .order('created_at', { ascending: true });
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
  if (!businessId) return null;
  const { data, error } = await _sb
    .from('businesses')
    .select('*')
    .eq('id', businessId)
    .single();
  if (error) { console.error('[CrewHub] dbLoadBusinessInfo error:', error); return null; }
  return data;
}

export async function dbUpdateBusiness(updates, businessId) {
  if (!businessId) return null;
  const { data, error } = await _sb
    .from('businesses')
    .update(updates)
    .eq('id', businessId)
    .select().single();
  if (error) { console.error('[CrewHub] dbUpdateBusiness error:', error); throw error; }
  return data;
}

export async function dbUploadLogo(file, businessId) {
  const ext  = file.name.split('.').pop().toLowerCase();
  const path = `${businessId}/logo.${ext}`;
  const { error: uploadError } = await _sb.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (uploadError) { console.error('[CrewHub] dbUploadLogo upload error:', uploadError); throw uploadError; }
  const { data } = _sb.storage.from('logos').getPublicUrl(path);
  // Cache-bust so the browser picks up the new file immediately
  const publicUrl = data.publicUrl + '?t=' + Date.now();
  await _sb.from('businesses').update({ logo_url: data.publicUrl }).eq('id', businessId);
  return publicUrl;
}

export async function dbRemoveLogo(businessId) {
  await _sb.from('businesses').update({ logo_url: null }).eq('id', businessId);
}
