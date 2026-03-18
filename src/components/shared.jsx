// ── Shared UI components + style tokens ──────────────────────────────────────
// Import these in any tab to keep modals, stat cards, and buttons consistent.

// ── Style tokens ─────────────────────────────────────────────────────────────

export const labelStyle = {
  fontSize: 12, fontWeight: 700, color: 'var(--muted)',
  textTransform: 'uppercase', letterSpacing: '0.08em',
  display: 'block', marginBottom: 6,
};

export const inputStyle = {
  width: '100%', padding: '10px 14px',
  border: '2px solid var(--gray)', borderRadius: 10,
  fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600,
  color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
};

export const modalOverlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(10,30,45,0.75)',
  zIndex: 1100, overflowY: 'auto', padding: '30px 16px',
  display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
};

export const modalContentStyle = {
  width: '100%', maxWidth: 440, background: 'white',
  borderRadius: 16, overflow: 'hidden',
  boxShadow: '0 12px 48px rgba(26,110,168,0.25)',
};

export const modalHeaderStyle = {
  background: 'var(--teal-dark)', padding: '20px 24px',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
};

// ── ModalShell ────────────────────────────────────────────────────────────────
// Fixed overlay + centered card + teal header with title, optional subtitle,
// and close button. Pass body content as children.
//
// Props:
//   title      — string (required)
//   onClose    — fn (required)
//   subtitle   — string (optional, shown below title in lighter text)
//   maxWidth   — number (default 440)
//   headerBg   — string (default 'var(--teal-dark)')
//   children   — body content

export function ModalShell({ title, subtitle, onClose, children, maxWidth = 440, headerBg = 'var(--teal-dark)' }) {
  return (
    <div
      style={{ ...modalOverlayStyle }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ ...modalContentStyle, maxWidth }}>
        {/* Header */}
        <div style={{ ...modalHeaderStyle, background: headerBg }}>
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 15 }}>{title}</div>
            {subtitle && (
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: 600, marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'white', fontSize: 24, cursor: 'pointer', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Body — passed as children */}
        {children}
      </div>
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────
// KPI card used in stats rows across CrmTab, ReportsTab, LeadsTab, etc.
//
// Props:
//   label      — string
//   value      — string | number
//   sub        — string (subtitle/explanation)
//   warn       — bool (highlights in red if true)
//   color      — string (value text color, overrides warn default)
//   border     — string (full border CSS string)
//   labelColor — string (label text color, overrides warn default)
//   subColor   — string (sub text color)
//   style      — object (extra styles on the outer card div)

export function StatCard({ label, value, sub, warn, color, border, labelColor, subColor, style }) {
  return (
    <div style={{
      flex: '1 1 140px', background: 'white', borderRadius: 12,
      padding: '14px 18px', boxShadow: '0 2px 8px rgba(26,110,168,0.08)',
      border: border || (warn ? '2px solid #fca5a5' : '2px solid transparent'),
      ...style,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
        color: labelColor || (warn ? '#dc2626' : 'var(--muted)'),
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 26, fontWeight: 800, margin: '4px 0',
        color: color || (warn ? '#dc2626' : 'var(--text)'),
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: subColor || 'var(--muted)' }}>{sub}</div>
    </div>
  );
}

// ── ActionButton ──────────────────────────────────────────────────────────────
// Pill-shaped action button. Replaces the local btn() / btnXS() pattern.
//
// Props:
//   bg       — background color (required)
//   color    — text color (default 'white')
//   onClick  — fn
//   disabled — bool
//   xs       — bool: smaller padding/font for use in table rows
//   style    — object: extra inline styles (merged last)
//   children — button label / content

export function ActionButton({ bg, color = 'white', onClick, disabled, xs, style, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg, color,
        border: 'none', borderRadius: 20,
        padding: xs ? '4px 10px' : '7px 14px',
        fontFamily: "'Nunito', sans-serif",
        fontWeight: 700,
        fontSize: xs ? 11 : 12,
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
