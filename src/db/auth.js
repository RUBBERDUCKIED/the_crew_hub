import { _sb } from './supabaseClient.js';

export async function dbBootstrapBusiness(businessName, ownerName, ownerEmail, serviceType = 'window-cleaning') {
  const { data, error } = await _sb.rpc('bootstrap_business', {
    biz_name:     businessName,
    owner_name:   ownerName,
    owner_email:  ownerEmail,
    service_type: serviceType,
  });
  if (error) { console.error('[CrewHub] dbBootstrapBusiness error:', error); throw error; }
  if (!data) throw new Error('Bootstrap returned no data');
  return data; // { businessId, memberId }
}

export async function dbLoadIdentity(authUserId) {
  if (!authUserId) return null;
  const { data, error } = await _sb
    .from('team_members')
    .select('id, business_id, role')
    .eq('auth_user_id', authUserId)
    .single();
  if (error || !data) return null;
  return { businessId: data.business_id, memberId: data.id, role: data.role };
}

export async function dbClaimInvite() {
  const { data, error } = await _sb.rpc('claim_team_invite');
  if (error) { console.error('[CrewHub] dbClaimInvite error:', error); return null; }
  return data || null; // { businessId, memberId, role }
}

export function canAccess(feature, userRole) {
  const permissions = {
    owner:      ['quotes', 'pipeline', 'today', 'crm', 'reports', 'leads', 'team', 'timesheets', 'settings'],
    dispatcher: ['quotes', 'pipeline', 'today', 'crm', 'reports', 'leads', 'timesheets'],
    crew:       ['today', 'leads', 'quotes', 'pipeline', 'crm', 'my-timesheet'],
  };
  return (permissions[userRole] || []).includes(feature);
}

// Re-export _sb for auth operations (signIn, signUp, etc.) that still live in legacy.js
export { _sb };
