import { useState, useMemo } from 'react';
import useAppStore from '../state/useAppStore.js';
import { CRM_TAG_PRESETS } from '../helpers/pricing.js';
import { fmtDate, fmtMoney, daysSince, fmtPhone } from '../helpers/formatting.js';
import { ModalShell, StatCard, ActionButton, labelStyle, inputStyle } from '../components/shared.jsx';

// ─────────────────────────────────────────────────────────────
// CRM Tab — Customer relationship management
// Phase 10 React migration
// ─────────────────────────────────────────────────────────────

const LEAD_SOURCES = [
  '', 'Web Search', 'Facebook Ad', 'Instagram Ad', 'Google Ad',
  'Radio Ad', 'TV Ad', 'Billboard / Real World Ad', 'YouTube Ad',
  'Flyer / Door Hanger', 'Referral Program', 'Email Marketing',
  'Cold Call / Door Knock',
];

const ATTENTION_DAYS = 90;

// ── Style constants (local, CRM-specific) ─────────────────────

const metaLabelSt = {
  fontSize: 11, fontWeight: 700, color: '#94a3b8',
  textTransform: 'uppercase', marginBottom: 2,
};

const sectionLabelSt = {
  fontSize: 13, fontWeight: 800, color: '#1a3a4a',
  marginBottom: 8, marginTop: 4,
};

const toolbarSelectSt = {
  padding: '8px 14px', border: '2px solid #e8f4f7', borderRadius: 20,
  fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
  color: '#1a6ea8', background: 'white', cursor: 'pointer', outline: 'none',
};

// ── EditModal ────────────────────────────────────────────────

function EditModal({ customer, onSave, onClose }) {
  const [form, setForm] = useState({
    name:       customer?.name       || '',
    address:    customer?.address    || '',
    phone:      customer?.phone      || '',
    email:      customer?.email      || '',
    leadSource: customer?.leadSource || '',
    tags:       [...(customer?.tags  || [])],
  });
  const [tagInput, setTagInput] = useState('');

  const setField = (f, v) => setForm(prev => ({ ...prev, [f]: v }));

  function toggleTag(tag) {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag],
    }));
  }

  function addCustomTag() {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) setForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
    setTagInput('');
  }

  async function handleSave() {
    if (!form.name.trim()) { alert('Customer name is required.'); return; }
    const updated = {
      ...(customer || {
        customerId: 'cust_' + Date.now(),
        createdAt:  new Date().toISOString(),
        archived:   false,
      }),
      ...form,
      updatedAt: new Date().toISOString(),
    };
    await onSave(updated);
  }

  return (
    <ModalShell
      title={customer ? '✏️ Edit Customer Info' : '➕ Add New Customer'}
      onClose={onClose}
      headerBg="#1a3a4a"
    >
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[
          ['Customer Name', 'name',    'text'],
          ['Address',       'address', 'text'],
          ['Phone Number',  'phone',   'tel'],
          ['Email Address', 'email',   'email'],
        ].map(([label, field, type]) => (
          <div key={field}>
            <label style={labelStyle}>{label}</label>
            <input
              type={type}
              value={form[field]}
              onChange={e => setField(field, e.target.value)}
              style={inputStyle}
            />
          </div>
        ))}

        {/* Lead source */}
        <div>
          <label style={labelStyle}>How Did They Hear About Us?</label>
          <select
            value={form.leadSource}
            onChange={e => setField('leadSource', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}
          >
            {LEAD_SOURCES.map(s => (
              <option key={s} value={s}>{s || '— Not recorded —'}</option>
            ))}
          </select>
        </div>

        {/* Tags */}
        <div>
          <label style={labelStyle}>Tags / Labels</label>

          {/* Active tags */}
          {form.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {form.tags.map(t => (
                <span
                  key={t}
                  onClick={() => toggleTag(t)}
                  style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  {t} <span style={{ color: '#93c5fd', fontSize: 14 }}>×</span>
                </span>
              ))}
            </div>
          )}

          {/* Preset suggestions */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {CRM_TAG_PRESETS.filter(t => !form.tags.includes(t)).map(t => (
              <span
                key={t}
                onClick={() => toggleTag(t)}
                style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px dashed #cbd5e1' }}
              >
                + {t}
              </span>
            ))}
          </div>

          {/* Custom tag */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomTag()}
              placeholder="Custom tag..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <ActionButton bg="#1a6ea8" onClick={addCustomTag} style={{ padding: '8px 14px' }}>Add</ActionButton>
          </div>
        </div>

        {/* Save / Cancel */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <ActionButton bg="#1a6ea8" onClick={handleSave} style={{ flex: 1, padding: 12, fontSize: 14 }}>
            💾 Save Changes
          </ActionButton>
          <ActionButton bg="#f1f5f9" color="#1a3a4a" onClick={onClose} style={{ flex: 1, padding: 12, fontSize: 14 }}>
            Cancel
          </ActionButton>
        </div>
      </div>
    </ModalShell>
  );
}

// ── CustomerCard ─────────────────────────────────────────────

function CustomerCard({ customer, notes, jobs, role, onEdit, onArchive, onDelete, onStampContact, onAddNote, onDeleteNote, onUpdateTags }) {
  const [expanded,    setExpanded]    = useState(false);
  const [addingNote,  setAddingNote]  = useState(false);
  const [noteText,    setNoteText]    = useState('');
  const [customTag,   setCustomTag]   = useState('');
  const [tagSaving,   setTagSaving]   = useState(false);

  const currentTags = customer.tags || [];

  async function toggleTagInline(tag) {
    const next = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag];
    setTagSaving(true);
    await onUpdateTags(customer.customerId, next);
    setTagSaving(false);
  }

  async function addCustomTagInline() {
    const t = customTag.trim();
    if (!t || currentTags.includes(t)) { setCustomTag(''); return; }
    setTagSaving(true);
    await onUpdateTags(customer.customerId, [...currentTags, t]);
    setCustomTag('');
    setTagSaving(false);
  }

  const days           = daysSince(customer.lastContactDate);
  const needsAttention = days !== null && days >= ATTENTION_DAYS;
  const wonJobs        = jobs.filter(j => j.won);
  const totalRev       = wonJobs.reduce((s, j) => s + (parseFloat(j.grand) || 0), 0);

  async function submitNote() {
    const t = noteText.trim();
    if (!t) return;
    await onAddNote(customer.customerId, t);
    setNoteText('');
    setAddingNote(false);
  }

  return (
    <div style={{
      background: 'white', borderRadius: 12, marginBottom: 10,
      boxShadow: '0 2px 8px rgba(26,110,168,0.08)',
      border: needsAttention ? '2px solid #fca5a5' : '2px solid transparent',
      overflow: 'hidden',
    }}>
      {/* ── Card Header ── */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '14px 18px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 12,
          background: expanded ? '#f0f9ff' : 'white',
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'linear-gradient(135deg,#1a6ea8,#0ea5e9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 800, fontSize: 16, flexShrink: 0,
        }}>
          {(customer.name || '?')[0].toUpperCase()}
        </div>

        {/* Name + contact */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#1a3a4a', marginBottom: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            {customer.name}
            {needsAttention && (
              <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                ⚠️ {days}d no contact
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {customer.address && <span>📍 {customer.address}</span>}
            {customer.phone   && <span>📞 {fmtPhone(customer.phone)}</span>}
          </div>
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 180 }}>
          {(customer.tags || []).map(t => (
            <span key={t} style={{
              background: '#dbeafe', color: '#1e40af', borderRadius: 20,
              padding: '2px 8px', fontSize: 11, fontWeight: 700,
            }}>{t}</span>
          ))}
        </div>

        {/* Revenue summary */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
          <div style={{ fontWeight: 800, color: '#059669', fontSize: 14 }}>{fmtMoney(totalRev)}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{wonJobs.length} won / {jobs.length} quotes</div>
        </div>

        {/* Chevron */}
        <div style={{ color: '#94a3b8', fontSize: 16, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</div>
      </div>

      {/* ── Expanded Body ── */}
      {expanded && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '18px 18px 16px' }}>

          {/* Prominent Add Note button */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <button
              onClick={() => setAddingNote(a => !a)}
              style={{
                background: addingNote ? '#059669' : '#1a6ea8',
                color: 'white', border: 'none', borderRadius: 30,
                padding: '10px 28px', fontFamily: "'Nunito',sans-serif",
                fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(26,110,168,0.25)',
                transition: 'all 0.15s',
              }}
            >{addingNote ? '✏️ Adding Note…' : '📝 + Add Note'}</button>
          </div>

          {/* Inline note input */}
          {addingNote && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitNote()}
                placeholder="Enter note..."
                style={{ ...inputStyle, flex: 1 }}
                autoFocus
              />
              <ActionButton bg="#059669" onClick={submitNote} style={{ padding: '8px 14px' }}>Save</ActionButton>
              <ActionButton bg="#f1f5f9" color="#1a3a4a" onClick={() => setAddingNote(false)} style={{ padding: '8px 14px' }}>Cancel</ActionButton>
            </div>
          )}

          {/* Contact detail row */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 14 }}>
            {customer.email && (
              <div>
                <div style={metaLabelSt}>Email</div>
                <a href={`mailto:${customer.email}`} style={{ color: '#1a6ea8', fontWeight: 600, fontSize: 13 }}>{customer.email}</a>
              </div>
            )}
            {customer.leadSource && (
              <div>
                <div style={metaLabelSt}>Lead Source</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{customer.leadSource}</div>
              </div>
            )}
            <div>
              <div style={metaLabelSt}>Last Contact</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(customer.lastContactDate)}</div>
            </div>
            <div>
              <div style={metaLabelSt}>Customer Since</div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{fmtDate(customer.createdAt)}</div>
            </div>
          </div>

          {/* Inline tag editor */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ ...sectionLabelSt, marginBottom: 6 }}>🏷️ Tags {tagSaving && <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400 }}>saving…</span>}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {currentTags.length === 0 && (
                <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>No tags — add from the list below</span>
              )}
              {currentTags.map(t => (
                <span
                  key={t}
                  onClick={() => toggleTagInline(t)}
                  title="Click to remove"
                  style={{ background: '#dbeafe', color: '#1e40af', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {t} <span style={{ color: '#93c5fd', fontSize: 14, lineHeight: 1 }}>×</span>
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {CRM_TAG_PRESETS.filter(t => !currentTags.includes(t)).map(t => (
                <span
                  key={t}
                  onClick={() => toggleTagInline(t)}
                  title="Click to add"
                  style={{ background: '#f1f5f9', color: '#64748b', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px dashed #cbd5e1' }}
                >
                  + {t}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={customTag}
                onChange={e => setCustomTag(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomTagInline()}
                placeholder="Custom tag…"
                style={{ flex: 1, padding: '6px 12px', border: '2px solid #e2e8f0', borderRadius: 20, fontFamily: 'Nunito,sans-serif', fontSize: 12, fontWeight: 600, outline: 'none' }}
              />
              <ActionButton bg="#1a6ea8" onClick={addCustomTagInline} style={{ padding: '6px 14px', fontSize: 12 }}>Add</ActionButton>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <ActionButton bg="#1a6ea8" onClick={() => onEdit(customer)}>✏️ Edit Info</ActionButton>
            <ActionButton
              bg="#059669"
              onClick={() => onStampContact(customer.customerId)}
              title="Records today as the last contact date — resets the 90-day attention warning"
            >📅 Log Contact Today</ActionButton>
            <ActionButton bg="#7c3aed" onClick={() => window.openPhotoModal?.(customer.customerId, customer.name)}>📷 Photos</ActionButton>
            <ActionButton bg="#d97706" onClick={() => window.preFillFromQuote?.({ name: customer.name, address: customer.address, phone: customer.phone, email: customer.email })}>➕ New Quote</ActionButton>
            {!customer.archived
              ? <ActionButton bg="#64748b" onClick={() => onArchive(customer.customerId, true)}>📦 Archive</ActionButton>
              : <ActionButton bg="#059669" onClick={() => onArchive(customer.customerId, false)}>📂 Restore</ActionButton>
            }
            {role === 'owner' && (
              <ActionButton bg="#dc2626" onClick={() => onDelete(customer.customerId)}>🗑️ Delete</ActionButton>
            )}
          </div>

          {/* Jobs / Quotes */}
          {jobs.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={sectionLabelSt}>📋 Quote / Job History</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {jobs.map((job, i) => (
                  <div key={job.id || i} style={{
                    background: '#f8fafc', borderRadius: 8, padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontWeight: 700, color: '#1a3a4a', fontSize: 13 }}>
                        #{job.quoteNum || i + 1}
                      </span>
                      <span style={{ marginLeft: 8, color: '#64748b', fontSize: 12 }}>
                        {job.plan || 'Custom'} — {fmtMoney(job.grand)}
                      </span>
                      {job.won      && <span style={{ marginLeft: 6, background: '#dcfce7', color: '#166534', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>WON</span>}
                      {job.invoiced && <span style={{ marginLeft: 4, background: '#dbeafe', color: '#1e40af', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>INVOICED</span>}
                      {job.receipted && <span style={{ marginLeft: 4, background: '#fef9c3', color: '#713f12', borderRadius: 20, padding: '1px 7px', fontSize: 11, fontWeight: 700 }}>PAID</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <ActionButton xs bg="#1a6ea8" onClick={() => window.generateQuoteFromSaved?.(job._idx)}>📄 Quote</ActionButton>
                      {job.won && (
                        <ActionButton xs bg="#059669" onClick={() => window.generateInvoiceFromSaved?.(job._idx)}>🧾 Invoice</ActionButton>
                      )}
                      {job.won && job.invoiced && (
                        <ActionButton xs bg="#7c3aed" onClick={() => window.generateReceiptFromSaved?.(job._idx)}>✅ Receipt</ActionButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <div style={sectionLabelSt}>📝 Notes</div>
            {notes.length === 0 && !addingNote ? (
              <div style={{ color: '#94a3b8', fontSize: 13, fontStyle: 'italic' }}>No notes yet.</div>
            ) : notes.map(note => (
              <div key={note.id} style={{
                background: '#fffbeb', borderRadius: 8, padding: '10px 14px',
                marginBottom: 6, display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#1a3a4a', fontWeight: 600 }}>{note.text}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>{note.date || '—'}</div>
                </div>
                <button
                  onClick={() => onDeleteNote(customer.customerId, note.id)}
                  style={{ background: 'none', border: 'none', color: '#fca5a5', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 4px' }}
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main CrmTab ──────────────────────────────────────────────

export default function CrmTab() {
  const customersMap = useAppStore(s => s.customers);
  const crmNotes     = useAppStore(s => s.crmNotes);
  const savedQuotes  = useAppStore(s => s.savedQuotes);
  const role         = useAppStore(s => s.currentUserRole);

  const [search,    setSearch]    = useState('');
  const [sortBy,    setSortBy]    = useState('name');
  const [filterTag, setFilterTag] = useState('');
  const [showArch,  setShowArch]  = useState(false);
  const [editCust,  setEditCust]  = useState(null);
  const [isAdding,  setIsAdding]  = useState(false);

  // Enrich customers with linked quotes/jobs + revenue
  const enriched = useMemo(() => {
    return Object.values(customersMap || {}).map(c => {
      const jobs = savedQuotes
        .map((q, idx) => ({ ...q, _idx: idx }))
        .filter(q =>
          q.customerId === c.customerId ||
          (q.name && c.name && q.name.toLowerCase() === c.name.toLowerCase())
        );
      const wonJobs = jobs.filter(j => j.won);
      const revenue = wonJobs.reduce((s, j) => s + (parseFloat(j.grand) || 0), 0);
      return { ...c, _jobs: jobs, _revenue: revenue, _wonCount: wonJobs.length };
    });
  }, [customersMap, savedQuotes]);

  // All unique tags across customers
  const allTags = useMemo(() => {
    const s = new Set();
    enriched.forEach(c => (c.tags || []).forEach(t => s.add(t)));
    return [...s].sort();
  }, [enriched]);

  // Stats
  const stats = useMemo(() => {
    const active  = enriched.filter(c => !c.archived);
    const attn    = active.filter(c => { const d = daysSince(c.lastContactDate); return d !== null && d >= ATTENTION_DAYS; });
    const revenue = enriched.reduce((s, c) => s + c._revenue, 0);
    const totalQ  = savedQuotes.length;
    const wonQ    = savedQuotes.filter(q => q.won).length;
    const pct     = totalQ > 0 ? Math.round((wonQ / totalQ) * 100) : 0;
    return { customers: active.length, totalQuotes: totalQ, won: wonQ, pct, attention: attn.length, revenue };
  }, [enriched, savedQuotes]);

  // Filtered + sorted list
  const filtered = useMemo(() => {
    let list = enriched.filter(c => !!c.archived === showArch);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name?.toLowerCase().includes(q) ||
        c.address?.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      );
    }
    if (filterTag) list = list.filter(c => (c.tags || []).includes(filterTag));
    return [...list].sort((a, b) => {
      if (sortBy === 'name')        return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'lastcontact') return (a.lastContactDate || '').localeCompare(b.lastContactDate || '');
      if (sortBy === 'revenue')     return b._revenue - a._revenue;
      return 0;
    });
  }, [enriched, showArch, search, filterTag, sortBy]);

  // ── Mutations ────────────────────────────────────────────

  async function handleSaveCustomer(data) {
    try {
      await window.dbSaveCustomer(data);
      setEditCust(null);
      setIsAdding(false);
    } catch (e) {
      console.error('[CrmTab] save customer:', e);
      alert('Failed to save customer: ' + e.message);
    }
  }

  async function handleDeleteCustomer(customerId) {
    if (!confirm('Permanently delete this customer and all their data? This cannot be undone.')) return;
    try {
      await window.dbDeleteCustomer(customerId);
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    }
  }

  async function handleUpdateTags(customerId, newTags) {
    const cust = customersMap[customerId];
    if (!cust) return;
    try { await window.dbSaveCustomer({ ...cust, tags: newTags }); }
    catch (e) { alert('Failed to update tags: ' + e.message); }
  }

  async function handleArchive(customerId, archived) {
    const cust = customersMap[customerId];
    if (!cust) return;
    try { await window.dbSaveCustomer({ ...cust, archived }); }
    catch (e) { alert('Archive failed: ' + e.message); }
  }

  function handleStampContact(customerId) {
    window.stampLastContact?.(customerId);
  }

  async function handleAddNote(customerId, text) {
    try { await window.dbSaveNote(customerId, text); }
    catch (e) { alert('Failed to save note: ' + e.message); }
  }

  async function handleDeleteNote(customerId, noteId) {
    if (!confirm('Delete this note?')) return;
    try { await window.dbDeleteNote(noteId, customerId); }
    catch (e) { alert('Failed to delete note: ' + e.message); }
  }

  function exportCSV() {
    const rows = [['Name','Address','Phone','Email','Lead Source','Tags','Revenue','Quotes','Won','Last Contact']];
    enriched.forEach(c => rows.push([
      c.name, c.address, c.phone, c.email, c.leadSource,
      (c.tags || []).join('|'),
      c._revenue.toFixed(2), c._jobs.length, c._wonCount,
      c.lastContactDate || '',
    ]));
    const csv = rows.map(r =>
      r.map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = `crm-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  // ── Render ───────────────────────────────────────────────

  return (
    <div style={{ padding: 20, fontFamily: 'Nunito, sans-serif' }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <StatCard label="Total Customers" value={stats.customers}                    sub="unique contacts" />
        <StatCard label="Total Quotes"    value={stats.totalQuotes}                  sub="all time" />
        <StatCard label="Won Bids"        value={`${stats.won} (${stats.pct}%)`}     sub="win rate" />
        <StatCard label="Needs Attention" value={stats.attention}                    sub="no contact 90+ days" warn={stats.attention > 0} />
        <StatCard label="Total Revenue"   value={fmtMoney(stats.revenue)}            sub="won jobs only" />
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍  Search customers..."
          style={{
            flex: '1 1 220px', padding: '9px 14px',
            border: '2px solid #e8f4f7', borderRadius: 20,
            fontFamily: 'Nunito, sans-serif', fontWeight: 700, fontSize: 13,
            color: '#1a3a4a', outline: 'none',
          }}
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={toolbarSelectSt}>
          <option value="name">Sort: Name A–Z</option>
          <option value="lastcontact">Sort: Last Contact</option>
          <option value="revenue">Sort: Revenue ↓</option>
        </select>
        <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={toolbarSelectSt}>
          <option value="">All Tags</option>
          {allTags.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <ActionButton
          bg={showArch ? '#1a6ea8' : 'white'}
          color={showArch ? 'white' : '#6b9aaa'}
          onClick={() => setShowArch(a => !a)}
          style={{ border: '2px solid #e8f4f7', padding: '8px 14px' }}
        >
          📦 {showArch ? 'Showing Archived' : 'Show Archived'}
        </ActionButton>
        <ActionButton bg="#0ea5e9" onClick={exportCSV}>📊 Export CSV</ActionButton>
        <ActionButton bg="#059669" onClick={() => setIsAdding(true)}>➕ Add Customer</ActionButton>
      </div>

      {/* Count line */}
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12, fontWeight: 600 }}>
        {filtered.length} {showArch ? 'archived' : 'active'} customer{filtered.length !== 1 ? 's' : ''}
        {search && ` matching "${search}"`}
        {filterTag && ` tagged "${filterTag}"`}
      </div>

      {/* Customer list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#94a3b8' }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>👥</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>
            {search || filterTag
              ? 'No customers match your search.'
              : showArch
                ? 'No archived customers.'
                : 'No customers yet — quotes you win will appear here.'}
          </div>
        </div>
      ) : filtered.map(c => (
        <CustomerCard
          key={c.customerId}
          customer={c}
          notes={crmNotes[c.customerId] || []}
          jobs={c._jobs}
          role={role}
          onEdit={cust => setEditCust(cust)}
          onArchive={handleArchive}
          onDelete={handleDeleteCustomer}
          onStampContact={handleStampContact}
          onAddNote={handleAddNote}
          onDeleteNote={handleDeleteNote}
          onUpdateTags={handleUpdateTags}
        />
      ))}

      {/* Edit / Add modal */}
      {(editCust || isAdding) && (
        <EditModal
          customer={isAdding ? null : editCust}
          onSave={handleSaveCustomer}
          onClose={() => { setEditCust(null); setIsAdding(false); }}
        />
      )}
    </div>
  );
}
