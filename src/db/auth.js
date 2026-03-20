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
  // Use .limit() instead of .single() — user may own multiple businesses
  const { data, error } = await _sb
    .from('team_members')
    .select('id, business_id, role')
    .eq('auth_user_id', authUserId)
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0];
  return { businessId: row.business_id, memberId: row.id, role: row.role };
}

export async function dbClaimInvite() {
  const { data, error } = await _sb.rpc('claim_team_invite');
  if (error) { console.error('[CrewHub] dbClaimInvite error:', error); return null; }
  return data || null; // { businessId, memberId, role }
}

export function canAccess(feature, userRole) {
  const permissions = {
    owner:      ['quotes', 'pipeline', 'today', 'crm', 'reports', 'leads', 'team', 'timesheets', 'settings'],
    admin:      ['quotes', 'pipeline', 'today', 'crm', 'reports', 'leads', 'team', 'timesheets', 'settings'],
    dispatcher: ['quotes', 'pipeline', 'today', 'crm', 'leads', 'timesheets'],
    crew:       ['today', 'my-timesheet', 'team'],
  };
  return (permissions[userRole] || []).includes(feature);
}

// Role hierarchy helper — returns true if roleA outranks roleB
const ROLE_RANK = { owner: 4, admin: 3, dispatcher: 2, crew: 1 };
export function roleAtLeast(userRole, minRole) {
  return (ROLE_RANK[userRole] || 0) >= (ROLE_RANK[minRole] || 99);
}

// Re-export _sb for auth operations (signIn, signUp, etc.) that still live in legacy.js
export { _sb };
