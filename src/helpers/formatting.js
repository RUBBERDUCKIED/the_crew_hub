// Pure text formatting utilities — no DOM, no state, no async

export function safeGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === '') return fallback;
    return JSON.parse(raw);
  } catch(e) {
    console.warn('[CrewHub] localStorage parse error for "' + key + '" — resetting to default.', e);
    return fallback;
  }
}

export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// DOM event handler — takes an <input> element and formats its value in place
export function formatPhone(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 10);
  let formatted = digits;
  if (digits.length > 6)      formatted = digits.slice(0,3) + '-' + digits.slice(3,6) + '-' + digits.slice(6);
  else if (digits.length > 3) formatted = digits.slice(0,3) + '-' + digits.slice(3);
  // Only update if value changed (prevents cursor jump on non-digit keys)
  if (input.value !== formatted) input.value = formatted;
}

// ── Date / time formatters ────────────────────────────────────────────────────

// "Mar 7, 2026" — accepts ISO string or Date object
export function fmtDate(dateOrStr) {
  if (!dateOrStr) return '—';
  const d = dateOrStr instanceof Date ? dateOrStr : new Date(dateOrStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// "Mon, Mar 7" — used in timesheet entry labels
export function formatDateLabel(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

// "2:30 PM"
export function formatTime(isoStr) {
  if (!isoStr) return '—';
  const d = new Date(isoStr);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Days elapsed since an ISO date string (returns 0 for today, negative for future)
export function daysSince(dateStr) {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d)) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

// ── Number formatters ─────────────────────────────────────────────────────────

// "$1,234.56"
export function fmtMoney(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// "Xh Ym" from total minutes
export function formatHM(mins) {
  if (!mins && mins !== 0) return '0h 0m';
  const m = Math.round(mins);
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Phone string formatter ────────────────────────────────────────────────────

// Pure string formatter — returns "(250) 555-1234" or original if can't format
export function fmtPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return raw;
}
