// Chat database layer — team messaging via Supabase + Realtime

import { _sb } from './supabaseClient.js';

/**
 * Load recent chat messages for a business.
 * Returns oldest-first so the chat panel can render top-to-bottom.
 */
export async function dbLoadMessages(businessId, limit = 50) {
  if (!businessId) return [];
  const { data, error } = await _sb
    .from('chat_messages')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('[CrewHub] dbLoadMessages error:', error); return []; }
  return (data || []).reverse(); // flip so oldest is first
}

/**
 * Send a chat message.
 */
export async function dbSendMessage(businessId, memberId, memberName, text) {
  const { data, error } = await _sb
    .from('chat_messages')
    .insert({
      business_id: businessId,
      member_id:   memberId,
      member_name: memberName,
      text:        text.trim(),
    })
    .select()
    .single();
  if (error) { console.error('[CrewHub] dbSendMessage error:', error); throw error; }
  return data;
}

/**
 * Subscribe to new chat messages in real-time.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(businessId, onNewMessage) {
  if (!businessId) return () => {};
  const channel = _sb.channel(`chat:${businessId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `business_id=eq.${businessId}`,
    }, payload => {
      onNewMessage(payload.new);
    })
    .subscribe();
  return () => _sb.removeChannel(channel);
}
