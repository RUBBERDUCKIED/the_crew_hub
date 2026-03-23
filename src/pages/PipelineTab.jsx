import { useState, useMemo, useEffect } from 'react';
import useAppStore from '../state/useAppStore.js';
import {
  getJobStage, getQuoteAgeDays,
  getNextDueDate, getDaysUntilDue,
} from '../helpers/quoteHelpers.js';
import { planLabel } from '../helpers/pricing.js';
import { fmtDate } from '../helpers/formatting.js';
import { ModalShell, labelStyle } from '../components/shared.jsx';

function getPhotoLabel(customerId, legacyKey) {
  const byId   = ((window.customerPhotos || {})[customerId] || []);
  const byName = ((window.customerPhotos || {})[legacyKey]  || []);
  const count  = byId.length + byName.filter(p => !byId.some(b => b.fileId === p.fileId)).length;
  return count > 0 ? `${count} 📷` : 'Photos';
}

// ── AgingBadge ────────────────────────────────────────────────────────────────

function AgingBadge({ q }) {
  if (getJobStage(q) !== 'quoted') return null;
  const days = getQuoteAgeDays(q);
  if (days < 1) return null;
  const cfg = days >= 10
    ? { bg: '#fee2e2', color: '#dc2626', border: '#fca5a5', icon: '🔴', text: `${days}d — Urgent` }
    : days >= 7
    ? { bg: '#fff7ed', color: '#c2410c', border: '#fdba74', icon: '🟠', text: `${days}d — Nudge Again` }
    : { bg: '#fefce8', color: '#a16207', border: '#fde047', icon: '🟡', text: `${days}d — Follow Up` };
  return (
    <span style={{
      background: cfg.bg, color: cfg.color,
      border: `1.5px solid ${cfg.border}`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap',
    }}>
      {cfg.icon} {cfg.text}
    </span>
  );
}

// ── JobCard ───────────────────────────────────────────────────────────────────

function JobCard({ q, jobIdx, onQuickNote }) {
  const rowClass = q.receipted ? 'won' : q.won === false ? 'lost' : q.won === true ? 'won' : '';
  const photoLabel = getPhotoLabel(q.customerId || '', (q.name || '').trim().toUpperCase());

  return (
    <div
      className={`saved-item ${rowClass}`}
      id={`si-${jobIdx}`}
      onClick={() => onQuickNote(jobIdx, q)}
      style={{ cursor: 'pointer' }}
      title="Click to add a note"
    >
      <div className="si-top-row">
        <div className="si-badge">{q.type}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="si-name">
            {q.company && (
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', display: 'block', lineHeight: 1.2 }}>
                {q.company}
              </span>
            )}
            {q.name}
          </div>
          {q.address && (
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q.address}
            </div>
          )}
        </div>
        <div className="si-total">${(q.grand || 0).toFixed(2)}</div>
        <div className="si-date">{q.date}</div>
        <AgingBadge q={q} />
        <button
          className="si-del"
          onClick={e => { e.stopPropagation(); if (window.deleteQuote) window.deleteQuote(jobIdx, e); }}
        >×</button>
      </div>

      <div className="si-btn-row">
        <button
          className="si-gen"
          style={{ background: '#6366f1', color: 'white', fontSize: 10, padding: '3px 8px' }}
          onClick={e => { e.stopPropagation(); if (window.openPhotoModalByIndex) window.openPhotoModalByIndex(jobIdx); }}
        >
          📷 {photoLabel}
        </button>

        <div className="won-toggle" style={{ margin: 0 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginRight: 4 }}>Bid:</span>
          {q.won !== false && (
            <button
              className={`won-btn ${q.won === true ? 'active-won' : ''}`}
              onClick={e => { e.stopPropagation(); if (window.toggleWon) window.toggleWon(jobIdx, q.won === true ? null : true); }}
            >✓ Won</button>
          )}
          {q.won !== true && (
            <button
              className={`won-btn lost-btn ${q.won === false ? 'active-lost' : ''}`}
              onClick={e => { e.stopPropagation(); if (window.toggleWon) window.toggleWon(jobIdx, q.won === false ? null : false); }}
            >✗ Lost</button>
          )}
        </div>

        <button
          className="si-gen"
          onClick={e => { e.stopPropagation(); if (window.generateQuoteFromSaved) window.generateQuoteFromSaved(jobIdx); }}
        >📄 Quote</button>

        {q.won === true && (
          <button
            className="si-gen"
            style={{ background: q.scheduled ? '#16a34a' : '#f97316', color: 'white' }}
            onClick={e => { e.stopPropagation(); if (window.openScheduleModal) window.openScheduleModal(jobIdx); }}
          >
            {q.scheduled ? '📅 Scheduled' : '📅 Schedule'}
          </button>
        )}

        {q.won === true && (
          <button
            className="si-gen"
            style={{ background: q.assignedTo ? '#8b5cf6' : '#94a3b8', color: 'white' }}
            onClick={e => { e.stopPropagation(); if (window.openAssignModal) window.openAssignModal(jobIdx); }}
          >
            {q.assignedTo
              ? `👤 ${(window._teamMembers || []).find(m => m.id === q.assignedTo)?.name || 'Assigned'}`
              : '👤 Assign'}
          </button>
        )}

        {q.won === true && (
          <button
            className="si-gen"
            style={{ background: 'var(--yellow)', color: 'var(--blue-dark)' }}
            onClick={e => { e.stopPropagation(); if (window.generateInvoiceFromSaved) window.generateInvoiceFromSaved(jobIdx); }}
          >🧾 Invoice</button>
        )}

        {q.invoiced && (
          <button
            className="si-gen"
            style={{ background: 'var(--blue)', color: 'white' }}
            onClick={e => { e.stopPropagation(); if (window.generateReceiptFromSaved) window.generateReceiptFromSaved(jobIdx); }}
          >✅ Receipt</button>
        )}
      </div>
    </div>
  );
}

// ── Stage section ─────────────────────────────────────────────────────────────

const STAGE_META = {
  quoted:   { label: '📋 Quoted — Reach Out to Win the Bid', bg: '#1a6ea8' },
  won:      { label: '🏆 Won — Schedule the Job',            bg: '#0d9488' },
  invoiced: { label: '🧾 Invoiced — Awaiting Payment',        bg: '#d97706' },
  complete: { label: '✅ Complete — Paid & Done',             bg: '#059669' },
  lost:     { label: '✗ Lost Bids',                          bg: '#dc2626' },
};

function StageSection({ stage, jobs, onQuickNote }) {
  if (!jobs.length) return null;
  const meta = STAGE_META[stage];

  // Aging summary chips in the Quoted header
  let agingSummary = null;
  if (stage === 'quoted') {
    const urgent   = jobs.filter(q => getQuoteAgeDays(q) >= 10).length;
    const nudge    = jobs.filter(q => getQuoteAgeDays(q) >= 7 && getQuoteAgeDays(q) < 10).length;
    const followup = jobs.filter(q => getQuoteAgeDays(q) >= 1 && getQuoteAgeDays(q) < 7).length;
    const parts = [];
    if (urgent)   parts.push(<span key="u" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 8px' }}>🔴 {urgent} urgent</span>);
    if (nudge)    parts.push(<span key="n" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 8px' }}>🟠 {nudge} nudge</span>);
    if (followup) parts.push(<span key="f" style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 20, padding: '2px 8px' }}>🟡 {followup} follow up</span>);
    if (parts.length) {
      agingSummary = (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 10, fontWeight: 700, marginLeft: 4 }}>
          {parts}
        </span>
      );
    }
  }

  return (
    <div className="pipeline-section">
      <div className="pipeline-section-header" style={{ background: meta.bg, color: 'white' }}>
        <span>{meta.label}</span>
        <span className="pipe-count">{jobs.length}</span>
        {agingSummary}
      </div>
      <div className="pipeline-section-body">
        {jobs.map(q => (
          <JobCard key={q._idx} q={q} jobIdx={q._idx} onQuickNote={onQuickNote} />
        ))}
      </div>
    </div>
  );
}

// ── Recurring panel ───────────────────────────────────────────────────────────

function RecurringRow({ q, days }) {
  const next      = getNextDueDate(q);
  const isOverdue = days < 0;
  const rowBg     = isOverdue ? '#fff5f5' : days <= 30 ? '#fffbea' : '#f0fdf4';
  const rowBorder = isOverdue ? '#fca5a5' : days <= 30 ? '#fde047' : '#86efac';
  const baseDateStr = q.invoicedDate
    ? `Invoiced ${q.invoicedDate}`
    : q.scheduledISO
      ? `Scheduled ${q.scheduledISO.slice(0, 10)}`
      : `Quoted ${q.date}`;

  const dueBadge = isOverdue
    ? <span style={{ color: '#dc2626', fontWeight: 800, whiteSpace: 'nowrap' }}>⚠ {Math.abs(days)}d overdue</span>
    : days === 0
      ? <span style={{ color: '#d97706', fontWeight: 800, whiteSpace: 'nowrap' }}>Due today!</span>
      : <span style={{ fontWeight: 800, color: 'var(--text)', whiteSpace: 'nowrap' }}>Due in {days}d</span>;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
      background: rowBg, border: `2px solid ${rowBorder}`, borderRadius: 10, flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{q.name}</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 1 }}>
          {q.address ? q.address + ' · ' : ''}{planLabel[q.plan] || (q.plan ? q.plan.charAt(0).toUpperCase() + q.plan.slice(1) : '')} · {baseDateStr}
        </div>
      </div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
        Next: {next ? fmtDate(next) : '—'}
      </div>
      {dueBadge}
      <button
        className="si-gen"
        style={{ background: 'var(--yellow)', color: 'var(--blue-dark)', whiteSpace: 'nowrap' }}
        onClick={() => { if (window.preFillFromQuote) window.preFillFromQuote(q); }}
      >✏️ Re-quote</button>
    </div>
  );
}

const RECURRING_TIERS = [
  { key: 'overdue',  label: '⚠ Overdue Return Visits',       bg: '#dc2626' },
  { key: 'soon',     label: '🔴 Due Within 30 Days',          bg: '#ea580c' },
  { key: 'upcoming', label: '🟡 Due in 1–3 Months',           bg: '#d97706' },
  { key: 'later',    label: '🟢 Scheduled Later (3+ Months)', bg: '#16a34a' },
];

function RecurringPanel({ tiers }) {
  const total = Object.values(tiers).reduce((s, a) => s + a.length, 0);
  if (!total) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontFamily: "'Montserrat', sans-serif", fontWeight: 900, fontSize: 12,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--teal-dark)',
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ width: 4, height: 16, background: 'var(--yellow)', borderRadius: 2, display: 'inline-block' }} />
        🔁 Recurring Return Visits
      </div>
      {RECURRING_TIERS.map(({ key, label, bg }) => {
        const items = tiers[key];
        if (!items.length) return null;
        return (
          <div key={key} className="pipeline-section" style={{ marginBottom: 10 }}>
            <div className="pipeline-section-header" style={{ background: bg, color: 'white' }}>
              {label} <span className="pipe-count">{items.length}</span>
            </div>
            <div className="pipeline-section-body" style={{ gap: 6 }}>
              {items.map(({ q, days }, i) => (
                <RecurringRow key={i} q={q} days={days} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Review Requests sub-tab ───────────────────────────────────────────────────

function ReviewCard({ q, jobIdx, isSent }) {
  const hasEmail = !!(q.email);
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: '16px 18px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      border: `2px solid ${isSent ? '#d1fae5' : '#e8f4f7'}`,
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{q.name || '—'}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{q.address || ''}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: hasEmail ? 'var(--teal)' : '#f97316', marginTop: 2 }}>
          {hasEmail ? `✉️ ${q.email}` : '⚠️ No email on file'}
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{q.quoteNum || ''}</div>
      {isSent
        ? <div style={{ background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 800 }}>✅ Sent</div>
        : (
          <button
            onClick={() => { if (window.sendReviewRequest) window.sendReviewRequest(jobIdx, null); }}
            title={!hasEmail ? 'Add email in CRM first' : ''}
            style={{
              background: '#f0d000', color: '#1a3a4a', border: 'none', borderRadius: 20,
              padding: '8px 18px', fontFamily: "'Nunito', sans-serif", fontWeight: 800,
              fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >⭐ Send Request</button>
        )
      }
    </div>
  );
}

function ReviewRequests({ savedQuotes, search }) {
  const sq = search.toLowerCase();
  const pending = savedQuotes
    .map((q, i) => ({ q, i }))
    .filter(({ q }) =>
      q.receipted && q.reviewPending && !q.reviewRequestSent &&
      (!sq || (q.name||'').toLowerCase().includes(sq) || (q.address||'').toLowerCase().includes(sq))
    );
  const sent = savedQuotes
    .map((q, i) => ({ q, i }))
    .filter(({ q }) =>
      q.receipted && q.reviewRequestSent &&
      (!sq || (q.name||'').toLowerCase().includes(sq) || (q.address||'').toLowerCase().includes(sq))
    );

  if (!pending.length && !sent.length) {
    return (
      <div style={{ background: 'white', borderRadius: 14, padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⭐</div>
        <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text)', marginBottom: 6 }}>No pending review requests</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
          When you generate a receipt, the customer will appear here so you can send them a review request.
        </div>
      </div>
    );
  }

  return (
    <div>
      {pending.length > 0 && (
        <>
          <div style={{
            background: '#1a3a4a', borderRadius: 12, padding: '12px 18px',
            marginBottom: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
          }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>
              ⭐ Pending Review Requests — {pending.length} customer{pending.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
            {pending.map(({ q, i }) => <ReviewCard key={i} q={q} jobIdx={i} isSent={false} />)}
          </div>
        </>
      )}
      {sent.length > 0 && (
        <>
          <div style={{ background: '#065f46', borderRadius: 12, padding: '12px 18px', marginBottom: 12 }}>
            <span style={{ color: 'white', fontWeight: 800, fontSize: 14 }}>
              ✅ Sent — {sent.length} customer{sent.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sent.map(({ q, i }) => <ReviewCard key={i} q={q} jobIdx={i} isSent={true} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Quick Note modal ──────────────────────────────────────────────────────────

function QuickNoteModal({ job, crmNotes, onClose }) {
  const [text, setText]     = useState('');
  const [saving, setSaving] = useState(false);

  const legacyKey = (job.name || '').trim().toUpperCase();
  const byId      = crmNotes[job.customerId] || [];
  const byName    = crmNotes[legacyKey]      || [];
  const seen      = new Set(byId.map(n => n.text + n.date));
  const notes     = [...byId];
  byName.forEach(n => { if (!seen.has(n.text + n.date)) notes.push(n); });

  async function handleSave() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      if (job.customerId && window.dbSaveNote) {
        await window.dbSaveNote(job.customerId, text.trim());
        if (window.stampLastContact) window.stampLastContact(job.customerId);
      } else {
        // Legacy path: no customerId — write directly to localStorage
        const stored = JSON.parse(localStorage.getItem('twc_crm_notes') || '{}');
        if (!stored[legacyKey]) stored[legacyKey] = [];
        stored[legacyKey].push({
          text: text.trim(),
          date: new Date().toLocaleDateString('en-CA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        });
        localStorage.setItem('twc_crm_notes', JSON.stringify(stored));
      }
      onClose();
    } catch (err) {
      console.error('[PipelineTab] QuickNote save error:', err);
      setSaving(false);
    }
  }

  const header = `${job.name || ''}${job.address ? ' — ' + job.address : ''} · ${job.quoteNum || ''} · $${job.grand ? job.grand.toFixed(2) : '0.00'}`;

  return (
    <ModalShell title="📝 Add CRM Note" subtitle={header} onClose={onClose}>
        {/* Body */}
        <div style={{ padding: '20px 24px' }}>
          {/* Previous notes */}
          {notes.length > 0 && (
            <div style={{ marginBottom: 14, maxHeight: 160, overflowY: 'auto' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Previous Notes
              </div>
              {[...notes].reverse().map((n, i) => (
                <div key={i} style={{ background: '#f8fafc', border: '1.5px solid var(--gray)', borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{n.text}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 3 }}>{n.date}</div>
                </div>
              ))}
            </div>
          )}
          {notes.length === 0 && (
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', fontStyle: 'italic', marginBottom: 14 }}>
              No previous notes for this customer.
            </div>
          )}

          <label style={{ ...labelStyle, marginBottom: 8 }}>
            New Note
          </label>
          <textarea
            rows={3}
            autoFocus
            placeholder="e.g. Left voicemail, called back about scheduling..."
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave(); }}
            style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--gray)', borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 14, fontWeight: 600, color: 'var(--text)', outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>Ctrl+Enter to save</div>

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1 }}
            >
              {saving ? '⏳ Saving...' : '💾 Save Note'}
            </button>
            <button
              onClick={onClose}
              style={{ flex: 1, background: '#f1f5f9', color: 'var(--text)', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >Cancel</button>
          </div>
        </div>
    </ModalShell>
  );
}

// ── Main PipelineTab ──────────────────────────────────────────────────────────

const STAGES_ALL   = ['quoted', 'won', 'invoiced', 'complete', 'lost'];

export default function PipelineTab() {
  const savedQuotes   = useAppStore(s => s.savedQuotes);
  const customers     = useAppStore(s => s.customers);
  const crmNotes      = useAppStore(s => s.crmNotes);
  const currentUserRole = useAppStore(s => s.currentUserRole);

  // Pipeline: dispatcher and above
  if (currentUserRole === 'crew') return null;

  const [typeFilter,  setTypeFilter]  = useState('all');
  const [stageFilter, setStageFilter] = useState('all');
  const [search,      setSearch]      = useState('');
  const [quickNote,   setQuickNote]   = useState(null); // { jobIdx, job }

  // Allow external navigation (e.g. Reports tab Outstanding click) to set filters
  useEffect(() => {
    function handleDeepLink(e) {
      if (e.detail?.stage) setStageFilter(e.detail.stage);
      if (e.detail?.type)  setTypeFilter(e.detail.type);
    }
    window.addEventListener('pipeline:setFilter', handleDeepLink);
    return () => window.removeEventListener('pipeline:setFilter', handleDeepLink);
  }, []);

  // ── Filtered + indexed jobs ──
  const filtered = useMemo(() => {
    const sq = search.toLowerCase();
    return savedQuotes
      .map((q, i) => ({ ...q, _idx: i }))
      .filter(q => {
        if (typeFilter !== 'all' && typeFilter !== 'reviews' && (q.type || '') !== typeFilter) return false;
        if (stageFilter !== 'all' && getJobStage(q) !== stageFilter) return false;
        if (sq && !(
          (q.name    || '').toLowerCase().includes(sq) ||
          (q.address || '').toLowerCase().includes(sq) ||
          (q.quoteNum|| '').toLowerCase().includes(sq)
        )) return false;
        return true;
      });
  }, [savedQuotes, typeFilter, stageFilter, search]);

  // ── Recurring data ──
  const recurringData = useMemo(() => {
    const customerLatest = {};
    savedQuotes.forEach(q => {
      if (!q.plan || q.plan === 'oneoff') return;
      if (!q.invoiced && !q.receipted) return;
      const key  = q.customerId || (q.name || '').trim().toUpperCase();
      const cust = q.customerId ? customers[q.customerId] : null;
      if (cust?.archived) return;
      if (typeFilter !== 'all' && typeFilter !== 'reviews' && (q.type || '') !== typeFilter) return;
      if (!customerLatest[key] || new Date(q.date) > new Date(customerLatest[key].date)) {
        customerLatest[key] = q;
      }
    });

    const tiers = { overdue: [], soon: [], upcoming: [], later: [] };
    Object.values(customerLatest).forEach(q => {
      const days = getDaysUntilDue(q);
      if (days === null) return;
      // Skip if a newer invoiced/receipted job exists for same customer
      const key = q.customerId || (q.name || '').trim().toUpperCase();
      const hasNewer = savedQuotes.some(r =>
        (r.customerId || (r.name || '').trim().toUpperCase()) === key &&
        r !== q && (r.invoiced || r.receipted) &&
        new Date(r.date) > new Date(q.date)
      );
      if (hasNewer) return;
      if      (days < 0)   tiers.overdue.push({ q, days });
      else if (days <= 30) tiers.soon.push({ q, days });
      else if (days <= 90) tiers.upcoming.push({ q, days });
      else                 tiers.later.push({ q, days });
    });
    Object.values(tiers).forEach(arr => arr.sort((a, b) => a.days - b.days));
    return tiers;
  }, [savedQuotes, customers, typeFilter]);

  const stages = stageFilter === 'all' ? STAGES_ALL : [stageFilter];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '28px 16px 60px' }}>

      {/* ── Type sub-tabs ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '2px solid var(--gray)', paddingBottom: 0 }}>
        {[
          { key: 'all',         label: '🏠 All Jobs' },
          { key: 'Residential', label: '🏡 Residential' },
          { key: 'Commercial',  label: '🏢 Commercial' },
          { key: 'Storefront',  label: '🪟 Storefront' },
          { key: 'reviews',     label: '⭐ Review Requests', ml: true },
        ].map(t => (
          <button
            key={t.key}
            className={`pipe-type-tab ${typeFilter === t.key ? 'active-type-tab' : ''}`}
            onClick={() => { setTypeFilter(t.key); setSearch(''); }}
            style={t.ml ? { marginLeft: 'auto' } : {}}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Search + stage filter bar (hidden on reviews tab) ── */}
      {typeFilter !== 'reviews' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
          <input
            type="text"
            className="crm-search"
            style={{ margin: 0, flex: 1, minWidth: 200 }}
            placeholder="🔍  Search by name, address, quote #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: 'all',      label: 'All' },
              { key: 'quoted',   label: '📋 Quoted' },
              { key: 'won',      label: '🏆 Won' },
              { key: 'invoiced', label: '🧾 Invoiced' },
              { key: 'complete', label: '✅ Complete' },
              { key: 'lost',     label: '✗ Lost' },
            ].map(f => (
              <button
                key={f.key}
                className={`pipe-filter ${stageFilter === f.key ? 'active-filter' : ''}`}
                onClick={() => setStageFilter(f.key)}
              >{f.label}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Search bar on reviews tab ── */}
      {typeFilter === 'reviews' && (
        <div style={{ marginBottom: 20 }}>
          <input
            type="text"
            className="crm-search"
            style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
            placeholder="🔍  Search reviews by name or address..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      )}

      {/* ── Recurring panel (only on non-reviews, all-stages view) ── */}
      {typeFilter !== 'reviews' && stageFilter === 'all' && (
        <RecurringPanel tiers={recurringData} />
      )}

      {/* ── Main content ── */}
      {typeFilter === 'reviews' ? (
        <ReviewRequests savedQuotes={savedQuotes} search={search} />
      ) : (
        <>
          {filtered.length === 0 ? (
            <div className="empty-msg" style={{ background: 'white', borderRadius: 10, padding: 24 }}>
              {search
                ? 'No results found.'
                : typeFilter !== 'all'
                  ? `No ${typeFilter} jobs yet.`
                  : 'No jobs yet — build a quote and hit Save Quote.'}
            </div>
          ) : (
            stages.map(stage => (
              <StageSection
                key={stage}
                stage={stage}
                jobs={filtered.filter(q => getJobStage(q) === stage)}
                onQuickNote={(jobIdx, job) => setQuickNote({ jobIdx, job })}
              />
            ))
          )}
        </>
      )}

      {/* ── Quick Note modal ── */}
      {quickNote && (
        <QuickNoteModal
          job={quickNote.job}
          crmNotes={crmNotes}
          onClose={() => setQuickNote(null)}
        />
      )}
    </div>
  );
}
