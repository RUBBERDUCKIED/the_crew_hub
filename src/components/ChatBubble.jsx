import { useState, useEffect, useRef, useCallback } from 'react';
import useAppStore from '../state/useAppStore.js';
import { dbLoadMessages, dbSendMessage, subscribeToMessages } from '../db/chat.js';
import { _sb } from '../db/supabaseClient.js';

// ─────────────────────────────────────────────────────────────
// ChatBubble — Floating draggable chat bubble + expandable panel
// Like Facebook Messenger bubble: always visible, draggable,
// shows unread badge, opens a chat panel on click.
// ─────────────────────────────────────────────────────────────

const BUBBLE_SIZE = 68;
const PANEL_W = 360;
const PANEL_H = 480;
const STORAGE_KEY = 'twc_chat_pos';

function formatTime(isoStr) {
  return new Date(isoStr).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: true });
}

function formatDateLabel(isoStr) {
  const d = new Date(isoStr);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

export default function ChatBubble() {
  const currentBusinessId = useAppStore(s => s.currentBusinessId);
  const currentMemberId   = useAppStore(s => s.currentMemberId);
  const currentUserRole   = useAppStore(s => s.currentUserRole);
  const isSignedIn        = useAppStore(s => s.isSignedIn);

  // Get current member name from window._teamMembers
  // Get current member name — try _teamMembers first, then query DB directly
  const memberName = useRef('');
  useEffect(() => {
    if (!currentMemberId) return;
    // Try local cache first
    const me = (window._teamMembers || []).find(m => m.id === currentMemberId);
    if (me?.name) { memberName.current = me.name; return; }
    // Fallback: query Supabase directly for this member's name
    _sb.from('team_members').select('name').eq('id', currentMemberId).limit(1)
      .then(({ data }) => {
        if (data?.[0]?.name) memberName.current = data[0].name;
      })
      .catch(() => {});
    // Also retry from _teamMembers after a delay
    const t = setTimeout(() => {
      const m = (window._teamMembers || []).find(m => m.id === currentMemberId);
      if (m?.name) memberName.current = m.name;
    }, 3000);
    return () => clearTimeout(t);
  }, [currentMemberId]);

  const [isOpen, setIsOpen]         = useState(false);
  const [messages, setMessages]     = useState([]);
  const [unreadCount, setUnread]    = useState(0);
  const [inputText, setInputText]   = useState('');
  const [sending, setSending]       = useState(false);
  const [loaded, setLoaded]         = useState(false);
  const messagesEndRef              = useRef(null);
  const isOpenRef                   = useRef(false);
  const chatBodyRef                 = useRef(null);

  // ── Drag state ──
  const [pos, setPos] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return { x: (typeof window !== 'undefined' ? window.innerWidth - 80 : 300), y: (typeof window !== 'undefined' ? window.innerHeight - 80 : 500) };
  });
  const dragging    = useRef(false);
  const dragMoved   = useRef(false);
  const offset      = useRef({ x: 0, y: 0 });

  // Keep isOpenRef in sync
  useEffect(() => { isOpenRef.current = isOpen; }, [isOpen]);

  // ── Load initial messages ──
  useEffect(() => {
    if (!currentBusinessId) return;
    setLoaded(false);
    dbLoadMessages(currentBusinessId, 50).then(msgs => {
      setMessages(msgs);
      setLoaded(true);
    });
  }, [currentBusinessId]);

  // ── Realtime subscription ──
  useEffect(() => {
    if (!currentBusinessId) return;
    const unsubscribe = subscribeToMessages(currentBusinessId, (newMsg) => {
      setMessages(prev => {
        // Deduplicate — don't add if already exists (from our own send)
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      // If panel is closed and message is from someone else, increment unread
      if (!isOpenRef.current && newMsg.member_id !== currentMemberId) {
        setUnread(prev => prev + 1);
      }
    });
    return unsubscribe;
  }, [currentBusinessId, currentMemberId]);

  // ── Auto-scroll to bottom on new messages (only if near bottom) ──
  useEffect(() => {
    if (!isOpen || !chatBodyRef.current) return;
    const el = chatBodyRef.current;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (isNearBottom) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }, [messages.length, isOpen]);

  // ── Scroll to bottom when opening panel ──
  useEffect(() => {
    if (isOpen) {
      setUnread(0);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
    }
  }, [isOpen]);

  // ── Send message ──
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await dbSendMessage(currentBusinessId, currentMemberId, memberName.current, text);
      setInputText('');
    } catch (e) {
      console.error('[ChatBubble] send error:', e);
    }
    setSending(false);
  }, [inputText, sending, currentBusinessId, currentMemberId]);

  // ── Drag handlers ──
  const onDragStart = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    dragMoved.current = false;
    const clientX = e.touches?.[0]?.clientX ?? e.clientX;
    const clientY = e.touches?.[0]?.clientY ?? e.clientY;
    offset.current = { x: clientX - pos.x, y: clientY - pos.y };

    const onMove = (ev) => {
      if (!dragging.current) return;
      const cx = ev.touches?.[0]?.clientX ?? ev.clientX;
      const cy = ev.touches?.[0]?.clientY ?? ev.clientY;
      const newX = Math.max(0, Math.min(window.innerWidth - BUBBLE_SIZE, cx - offset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - BUBBLE_SIZE, cy - offset.current.y));
      if (Math.abs(cx - (pos.x + offset.current.x)) > 5 || Math.abs(cy - (pos.y + offset.current.y)) > 5) {
        dragMoved.current = true;
      }
      setPos({ x: newX, y: newY });
    };

    const onEnd = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onEnd);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      // Save position
      setPos(p => { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); return p; });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }, [pos]);

  const onBubbleClick = useCallback(() => {
    if (!dragMoved.current) setIsOpen(prev => !prev);
  }, []);

  // Don't render if not signed in
  if (!isSignedIn || !currentBusinessId) return null;

  // ── Panel position — open above the bubble ──
  const panelLeft = Math.min(pos.x, window.innerWidth - PANEL_W - 8);
  const panelTop = pos.y - PANEL_H - 12;
  const panelAbove = panelTop > 8;
  const finalPanelTop = panelAbove ? panelTop : pos.y + BUBBLE_SIZE + 12;
  const finalPanelLeft = Math.max(8, panelLeft);

  // ── Group messages by date ──
  let lastDate = '';

  return (
    <>
      {/* ── Chat Panel ── */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          left: finalPanelLeft,
          top: finalPanelTop,
          width: Math.min(PANEL_W, window.innerWidth - 16),
          height: PANEL_H,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          zIndex: 9998,
          fontFamily: "'Nunito', sans-serif",
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--teal, #1e7d93), var(--teal-dark, #1a6ea8))',
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>💬 Team Chat</div>
            <button
              onClick={() => setIsOpen(false)}
              style={{ background: 'none', border: 'none', color: 'white', fontSize: 22, cursor: 'pointer', lineHeight: 1, padding: 0 }}
            >×</button>
          </div>

          {/* Messages */}
          <div
            ref={chatBodyRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              background: '#f7f9fb',
            }}
          >
            {!loaded && <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, padding: 20 }}>Loading...</div>}
            {loaded && messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#aaa', fontSize: 13, padding: 40 }}>
                No messages yet. Say hi to your team!
              </div>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.member_id === currentMemberId;
              const showName = i === 0 || messages[i - 1].member_id !== msg.member_id;
              const dateLabel = formatDateLabel(msg.created_at);
              let dateDivider = null;
              if (dateLabel !== lastDate) {
                lastDate = dateLabel;
                dateDivider = (
                  <div key={'date-' + msg.id} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ab4bc', margin: '12px 0 6px', letterSpacing: '0.05em' }}>
                    {dateLabel}
                  </div>
                );
              }
              return (
                <div key={msg.id}>
                  {dateDivider}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginTop: showName ? 8 : 1 }}>
                    {showName && !isMe && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: '#6b9aaa', marginBottom: 2, marginLeft: 4 }}>
                        {msg.member_name}
                      </div>
                    )}
                    <div style={{
                      background: isMe
                        ? 'linear-gradient(135deg, var(--teal, #1e7d93), var(--teal-dark, #1a6ea8))'
                        : '#e8eef2',
                      color: isMe ? 'white' : '#1a3a4a',
                      padding: '8px 14px',
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      maxWidth: '80%',
                      fontSize: 13,
                      fontWeight: 600,
                      lineHeight: 1.5,
                      wordBreak: 'break-word',
                    }}>
                      {msg.text}
                    </div>
                    <div style={{ fontSize: 10, color: '#aac4cc', marginTop: 2, marginLeft: 4, marginRight: 4 }}>
                      {formatTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid #e8eef2',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            flexShrink: 0,
            background: 'white',
          }}>
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type a message..."
              style={{
                flex: 1,
                padding: '10px 14px',
                border: '2px solid #e2e8f0',
                borderRadius: 24,
                fontFamily: "'Nunito', sans-serif",
                fontSize: 13,
                fontWeight: 600,
                outline: 'none',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!inputText.trim() || sending}
              style={{
                background: 'var(--teal, #1e7d93)',
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: 38,
                height: 38,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: !inputText.trim() || sending ? 'not-allowed' : 'pointer',
                opacity: !inputText.trim() || sending ? 0.5 : 1,
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── Floating Bubble ── */}
      <div
        onMouseDown={onDragStart}
        onTouchStart={onDragStart}
        onClick={onBubbleClick}
        style={{
          position: 'fixed',
          left: pos.x,
          top: pos.y,
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--teal, #1e7d93), var(--teal-dark, #1a6ea8))',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          zIndex: 9999,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          transition: dragging.current ? 'none' : 'box-shadow 0.2s',
        }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.836 1.37 5.373 3.528 7.063L4.5 22l4.217-1.687A10.7 10.7 0 0 0 12 20.486c5.523 0 10-4.145 10-9.243S17.523 2 12 2Z" fill="white" fillOpacity="0.95"/>
          <circle cx="8" cy="11" r="1.2" fill="var(--teal, #1e7d93)"/>
          <circle cx="12" cy="11" r="1.2" fill="var(--teal, #1e7d93)"/>
          <circle cx="16" cy="11" r="1.2" fill="var(--teal, #1e7d93)"/>
        </svg>
        {/* Unread badge */}
        {unreadCount > 0 && !isOpen && (
          <div style={{
            position: 'absolute',
            top: -4,
            right: -4,
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: 22,
            height: 22,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 900,
            fontFamily: "'Nunito', sans-serif",
            border: '2px solid white',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </div>
        )}
      </div>
    </>
  );
}
