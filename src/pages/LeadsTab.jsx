import { useState, useMemo } from 'react';
import useAppStore from '../state/useAppStore.js';
import { scoreClass } from '../helpers/leadHelpers.js';
import { ModalShell, inputStyle, labelStyle } from '../components/shared.jsx';
const filterSelectStyle = {
  padding: '8px 12px', border: '2px solid var(--gray)', borderRadius: 10,
  fontFamily: "'Nunito',sans-serif", fontSize: 12, fontWeight: 700,
  color: 'var(--text)', background: 'white', cursor: 'pointer',
};

// ── LeadCard ──
function LeadCard({ lead, noteInput, onNoteInput, onUpdateStatus, onAddNote, onDeleteNote, onQuote, onSendToCRM, onDelete }) {
  const score = lead.ai_score != null ? lead.ai_score : '?';
  const tags  = (lead.ai_tags || []).filter(t => t !== 'fallback_score' && t !== 'unrated');
  const notes = lead.notes || [];
  const seg   = lead.lead_segment || 'commercial';
  const segLabel = seg === 'commercial' ? '🏢 Commercial' : seg === 'storefront' ? '🏪 Storefront' : '🏠 Residential';

  return (
    <div className="lead-card">
      <div className="lead-card-header">
        <div className={`lead-score-badge ${scoreClass(lead.ai_score)}`}>{score}</div>

        <div className="lead-info" style={{ flex: 1 }}>
          <span className={`lead-segment-pill seg-${seg}`}>{segLabel}</span>
          <div className="lead-name">{lead.name}</div>
          {lead.owner_name && <div className="lead-owner">👤 {lead.owner_name}</div>}
          <div className="lead-address">📍 {lead.address}</div>
          {lead.phone
            ? <div className="lead-phone" style={{ fontSize: 14, fontWeight: 800, color: '#0d9488', marginTop: 3 }}>📞 {lead.phone}</div>
            : <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>📞 No phone on file</div>
          }
          {lead.business_blurb && <div className="lead-blurb">{lead.business_blurb}</div>}
          {lead.ai_note        && <div className="lead-ai-note">💡 {lead.ai_note}</div>}
          {tags.length > 0 && (
            <div className="lead-tags">
              {tags.map(t => <span key={t} className={`lead-tag ${t}`}>{t.replace(/_/g, ' ')}</span>)}
            </div>
          )}
        </div>

        <div className="lead-actions">
          <select
            className="lead-status-select"
            value={lead.status || 'new'}
            onChange={e => onUpdateStatus(lead.id, e.target.value)}
            title="Status"
          >
            {['new','contacted','quoted','won','lost'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button
            className="lead-btn"
            style={{ background: '#f0fdf4', color: '#16a34a', border: '1.5px solid #86efac' }}
            onClick={() => onQuote(lead.id)}
          >📋 Quote</button>
          <button className="lead-btn lead-btn-teal" onClick={() => onSendToCRM(lead.id)}>👥 CRM</button>
          <button className="lead-btn lead-btn-red"  onClick={() => onDelete(lead.id)}>✕</button>
        </div>
      </div>

      {notes.length > 0 && (
        <div className="lead-notes-list">
          {notes.map((n, i) => (
            <div key={i} className="lead-note-entry" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                {n.text}
                <div className="lead-note-meta">{n.date}</div>
              </div>
              <button
                onClick={() => onDeleteNote(lead.id, i)}
                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: 15, fontWeight: 900, padding: '0 2px', flexShrink: 0, lineHeight: 1 }}
                title="Delete note"
              >✕</button>
            </div>
          ))}
        </div>
      )}

      <div className="lead-note-row">
        <input
          className="lead-note-input"
          type="text"
          placeholder="Add a note before you call..."
          value={noteInput}
          onChange={e => onNoteInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onAddNote(lead.id); }}
        />
        <button className="lead-btn lead-btn-teal" onClick={() => onAddNote(lead.id)}>+ Note</button>
      </div>
    </div>
  );
}

// ── NeighbourhoodCard ──
function NeighbourhoodCard({ n }) {
  const score  = n.score != null ? n.score : '?';
  const rec    = n.campaign_recommendation || '';
  const season = n.best_season || '';
  const badgeRec = rec === 'door_hanger' ? 'Door Hanger'
    : rec === 'door_knock'  ? 'Door Knock'
    : rec === 'both'        ? 'Door Hanger + Knock'
    : rec;

  return (
    <div className="nbhd-card">
      <div className="nbhd-header">
        <div className={`nbhd-score ${scoreClass(n.score)}`}>{score}</div>
        <div className="nbhd-info">
          <div className="nbhd-name">{n.name}</div>
          <div className="nbhd-meta">
            {n.housing_type || ''} · {n.avg_income_bracket || ''} income · {(n.postal_codes || []).join(', ')}
          </div>
        </div>
      </div>
      <div className="nbhd-badges">
        {rec && rec !== 'skip' && <span className={`nbhd-badge badge-${rec}`}>{badgeRec}</span>}
        {season && <span className={`nbhd-badge badge-${season}`}>Best: {season}</span>}
      </div>
      {n.ai_summary    && <div className="nbhd-summary">{n.ai_summary}</div>}
      {n.pitch_template && <div className="nbhd-pitch">"{n.pitch_template}"</div>}
    </div>
  );
}

// ── ManualLeadModal ──
const CATEGORIES = [
  { value: 'restaurant',         label: 'Restaurant' },
  { value: 'cafe',               label: 'Cafe' },
  { value: 'hotel',              label: 'Hotel' },
  { value: 'retail',             label: 'Retail' },
  { value: 'office',             label: 'Office' },
  { value: 'winery',             label: 'Winery' },
  { value: 'gym',                label: 'Gym' },
  { value: 'salon',              label: 'Salon' },
  { value: 'medical',            label: 'Medical' },
  { value: 'dental',             label: 'Dental' },
  { value: 'auto_dealer',        label: 'Auto Dealer' },
  { value: 'real_estate_agency', label: 'Real Estate' },
  { value: 'property_management',label: 'Property Mgmt' },
  { value: 'residential',        label: 'Residential Home' },
  { value: 'other',              label: 'Other' },
];

// ManualLeadModal manages its own form state internally.
// When the user clicks Save, it calls onSave(formData) with the collected values.
// The parent only needs to handle { onSave, onClose } props.
function ManualLeadModal({ onSave, onClose }) {
  const [name,    setName]    = useState('');
  const [address, setAddress] = useState('');
  const [phone,   setPhone]   = useState('');
  const [email,   setEmail]   = useState('');
  const [notes,   setNotes]   = useState('');
  const [type,    setType]    = useState('commercial');
  const [cat,     setCat]     = useState('restaurant');

  function handleSubmit() {
    if (!name.trim()) { alert('Please enter a name.'); return; }
    onSave({ name, address, phone, email, notes, type, cat });
  }

  return (
    <ModalShell title="➕ Add Manual Lead" onClose={onClose} maxWidth={480}>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>Business / Contact Name *</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Tim Hortons - Main St" style={inputStyle} autoFocus />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ ...inputStyle, fontSize: 13, fontWeight: 700, background: 'white' }}>
                <option value="commercial">🏢 Commercial</option>
                <option value="storefront">🏪 Storefront / Route</option>
                <option value="residential">🏠 Residential</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Category</label>
              <select value={cat} onChange={e => setCat(e.target.value)}
                style={{ ...inputStyle, fontSize: 13, fontWeight: 700, background: 'white' }}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label style={labelStyle}>Address</label>
            <input type="text" value={address} onChange={e => setAddress(e.target.value)}
              placeholder="123 Main St, Penticton, BC" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Phone</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                placeholder="250-555-1234" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="manager@business.com" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Anything useful — who you spoke with, best time to call, etc."
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
            <button onClick={handleSubmit} style={{ flex: 1, background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              💾 Save Lead
            </button>
            <button onClick={onClose} style={{ flex: 1, background: '#f1f5f9', color: 'var(--text)', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito',sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
    </ModalShell>
  );
}

// ── Main Component ──
export default function LeadsTab() {
  const leads           = useAppStore(s => s.leads);
  const neighborhoods   = useAppStore(s => s.neighborhoods);
  const customers       = useAppStore(s => s.customers);
  const currentUserRole = useAppStore(s => s.currentUserRole);

  // Leads: dispatcher and above
  if (currentUserRole === 'crew') return null;

  // Tab + filter state
  const [activeTab,     setActiveTab]     = useState('commercial');
  const [search,        setSearch]        = useState('');
  const [filterCat,     setFilterCat]     = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterScore,   setFilterScore]   = useState(0);

  // Note inputs keyed by lead id
  const [noteInputs, setNoteInputs] = useState({});

  // Manual lead modal
  const [showManualModal, setShowManualModal] = useState(false);

  // ── Derived data ──
  const stats = useMemo(() => ({
    total:       leads.length,
    highVal:     leads.filter(l => (l.ai_score || 0) >= 8).length,
    contacted:   leads.filter(l => l.status === 'contacted').length,
    won:         leads.filter(l => l.status === 'won').length,
    commercial:  leads.filter(l => (l.lead_segment || 'commercial') === 'commercial').length,
    storefront:  leads.filter(l => (l.lead_segment || '') === 'storefront').length,
    residential: leads.filter(l => (l.lead_segment || '') === 'residential').length,
  }), [leads]);

  const lastRun = useMemo(() => {
    let raw = localStorage.getItem('twc_leads_lastrun') || '';
    let prev;
    do { prev = raw; try { const p = JSON.parse(raw); if (typeof p === 'string') raw = p; else break; } catch { break; } } while (raw !== prev);
    if (!raw) return '—';
    const d = new Date(raw);
    return isNaN(d.getTime()) ? raw : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (activeTab === 'neighbourhoods') return [];
    return leads.filter(lead => {
      const seg = lead.lead_segment || 'commercial';
      if (seg !== activeTab) return false;
      if (filterCat    && lead.category !== filterCat)             return false;
      if (filterStatus && lead.status   !== filterStatus)          return false;
      if (filterScore  && (lead.ai_score || 0) < filterScore)      return false;
      if (search) {
        const haystack = (lead.name + ' ' + lead.address + ' ' + (lead.owner_name || '')).toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [leads, activeTab, search, filterCat, filterStatus, filterScore]);

  const categories = useMemo(() => {
    const seg = activeTab === 'neighbourhoods' ? 'commercial' : activeTab;
    const cats = [...new Set(leads.filter(l => (l.lead_segment || 'commercial') === seg).map(l => l.category).filter(Boolean))];
    return cats.sort();
  }, [leads, activeTab]);

  // ── Handlers ──
  async function handleUpdateStatus(id, status) {
    try {
      const lead = leads.find(l => l.id === id);
      if (!lead) return;
      const updated = { ...lead, status };
      if (status === 'contacted') updated.lastContact = new Date().toISOString().slice(0, 10);
      if (window.dbSaveLead) await window.dbSaveLead(updated);
    } catch (e) {
      console.error('[LeadsTab] updateStatus:', e);
      alert('Failed to update lead status: ' + (e.message || e));
    }
  }

  async function handleAddNote(id) {
    try {
      const text = (noteInputs[id] || '').trim();
      if (!text) return;
      const lead = leads.find(l => l.id === id);
      if (!lead) return;
      const updated = { ...lead, notes: [...(lead.notes || []), { text, date: new Date().toLocaleDateString('en-CA') }] };
      if (window.dbSaveLead) await window.dbSaveLead(updated);
      setNoteInputs(prev => ({ ...prev, [id]: '' }));
    } catch (e) {
      console.error('[LeadsTab] addNote:', e);
      alert('Failed to save note: ' + (e.message || e));
    }
  }

  async function handleDeleteNote(id, index) {
    try {
      const lead = leads.find(l => l.id === id);
      if (!lead || !lead.notes) return;
      const updated = { ...lead, notes: lead.notes.filter((_, i) => i !== index) };
      if (window.dbSaveLead) await window.dbSaveLead(updated);
    } catch (e) {
      console.error('[LeadsTab] deleteNote:', e);
      alert('Failed to delete note: ' + (e.message || e));
    }
  }

  function handleQuoteFromLead(id) {
    if (window.quoteFromLead) window.quoteFromLead(id);
  }

  async function handleDeleteLead(id) {
    if (!confirm('Delete this lead?')) return;
    try {
      if (window.dbDeleteLead) await window.dbDeleteLead(id);
    } catch (e) {
      console.error('[LeadsTab] deleteLead:', e);
      alert('Failed to delete lead: ' + (e.message || e));
    }
  }

  async function handleSendToCRM(id) {
    try {
      const lead = leads.find(l => l.id === id);
      if (!lead) return;
      const alreadyExists = Object.values(customers).some(c => c._leadId === id);
      if (alreadyExists) { alert(`"${lead.name}" is already in your CRM.`); return; }
      const custId = 'cust_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      const newCustomer = {
        customerId: custId, _leadId: id,
        name: lead.name, company: lead.name,
        address: lead.address, phone: lead.phone || '', email: lead.email || '',
        leadSource: 'Lead Pipeline', tags: [], archived: false,
        createdAt: new Date().toISOString(),
      };
      if (window.dbSaveCustomer) await window.dbSaveCustomer(newCustomer);
      const updated = { ...lead, status: 'contacted' };
      if (window.dbSaveLead) await window.dbSaveLead(updated);
      alert(`✅ "${lead.name}" added to CRM!`);
    } catch (e) {
      console.error('[LeadsTab] sendToCRM:', e);
      alert('Failed to send lead to CRM: ' + (e.message || e));
    }
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        const newLeads  = data.commercial_leads          || [];
        const newNbhds  = data.neighborhood_intelligence || [];
        const generated = data.generated                 || '';

        // Merge: preserve user status & notes for existing leads
        const existingById = {};
        leads.forEach(l => { existingById[l.id] = l; });
        newLeads.forEach(lead => {
          if (existingById[lead.id]) {
            lead.status = existingById[lead.id].status || lead.status || 'new';
            lead.notes  = existingById[lead.id].notes  || lead.notes  || [];
          }
          lead.status = lead.status || 'new';
          lead.notes  = lead.notes  || [];
        });

        if (window.dbSaveLeadsBatch)        await window.dbSaveLeadsBatch(newLeads);
        if (newNbhds.length && window.dbSaveNeighborhoodsBatch) await window.dbSaveNeighborhoodsBatch(newNbhds);
        if (generated) localStorage.setItem('twc_leads_lastrun', generated);

        alert(`✅ Imported ${newLeads.length} leads and ${newNbhds.length} neighbourhoods`);
      } catch {
        alert('Error reading file. Make sure it is a valid Lead Pipeline JSON.');
      }
      event.target.value = '';
    };
    reader.readAsText(file);
  }

  async function handleSaveManualLead(formData) {
    try {
      const { name, address, phone, email, notes, type, cat } = formData;
      const lead = {
        id:             'lead_manual_' + Date.now(),
        name:           name.trim(),
        type:           type === 'residential' ? 'residential' : 'commercial',
        lead_segment:   type,
        category:       cat,
        address:        address.trim(),
        phone:          phone.trim(),
        email:          email.trim(),
        website: '', rating: 0, review_count: 0,
        source: 'manual', place_id: '', status: 'new',
        ai_score: null, ai_tags: [], ai_note: '',
        business_blurb: '', owner_name: '',
        notes: [], lat: null, lng: null,
      };
      if (notes.trim()) lead.notes.push({ text: notes.trim(), date: new Date().toLocaleDateString('en-CA') });
      if (window.dbSaveLead) await window.dbSaveLead(lead);
      setShowManualModal(false);
    } catch (e) {
      console.error('[LeadsTab] saveManualLead:', e);
      alert('Failed to save lead: ' + (e.message || e));
    }
  }

  function handleExportCSV() {
    if (!leads.length) { alert('No leads to export.'); return; }
    const cols = ['Name','Category','Type','Address','Phone','Email','AI Score','Tags','Status','Source','AI Note'];
    const rows = leads.map(l => [
      l.name, l.category, l.type, l.address, l.phone || '', l.email || '',
      l.ai_score || '', (l.ai_tags || []).join('; '), l.status, l.source, l.ai_note || ''
    ]);
    const csv = [cols, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `CrewHub_Leads_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Sub-tab config ──
  const subtabs = [
    { key: 'commercial',    label: '🏢 Commercial',     count: stats.commercial },
    { key: 'storefront',    label: '🏪 Storefront',      count: stats.storefront },
    { key: 'residential',   label: '🏠 Residential',     count: stats.residential },
    { key: 'neighbourhoods',label: '🏘️ Neighbourhoods',  count: neighborhoods.length },
  ];

  // ── Render ──
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 60px' }}>

      {/* Header + action buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal-dark)' }}>🎯 Lead Pipeline</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Last run: {lastRun}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <label className="lead-btn lead-btn-teal" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            📂 Import
            <input type="file" accept=".json" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
          <button className="lead-btn lead-btn-teal" onClick={() => setShowManualModal(true)}>+ Add Lead</button>
          <button className="lead-btn" onClick={handleExportCSV}>📥 CSV</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Total Leads',    val: stats.total,     color: 'var(--teal-dark)' },
          { label: 'High Value (8+)',val: stats.highVal,   color: '#059669' },
          { label: 'Contacted',      val: stats.contacted, color: 'var(--blue)' },
          { label: 'Won',            val: stats.won,       color: '#10b981' },
          { label: 'Last Import',    val: lastRun,         color: 'var(--muted)', small: true },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ textAlign: 'center', padding: '10px 8px' }}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color, fontSize: s.small ? 13 : undefined, wordBreak: 'break-word' }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '2px solid var(--gray)', overflowX: 'auto' }}>
        {subtabs.map(t => (
          <button
            key={t.key}
            className={`leads-subtab${activeTab === t.key ? ' active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}{t.count > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}> ({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Filter bar (hidden on neighbourhoods tab) */}
      {activeTab !== 'neighbourhoods' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="🔍 Search leads..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 180, padding: '8px 14px', border: '2px solid var(--gray)', borderRadius: 10, fontFamily: "'Nunito',sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
          />
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)} style={filterSelectStyle}>
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={filterSelectStyle}>
            <option value="">All Statuses</option>
            {['new','contacted','quoted','won','lost'].map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <select value={filterScore} onChange={e => setFilterScore(parseInt(e.target.value) || 0)} style={filterSelectStyle}>
            <option value="0">Any Score</option>
            <option value="8">High Value (8+)</option>
            <option value="6">Medium+ (6+)</option>
          </select>
        </div>
      )}

      {/* Content: lead cards OR neighbourhood cards */}
      {activeTab === 'neighbourhoods' ? (
        neighborhoods.length === 0
          ? <div className="empty-msg">No neighbourhood data yet. Import agent results to see marketing intelligence.</div>
          : neighborhoods.map((n, i) => <NeighbourhoodCard key={i} n={n} />)
      ) : (
        filteredLeads.length === 0
          ? <div className="empty-msg">No {activeTab} leads found. Import agent results or add a lead manually.</div>
          : filteredLeads.map(lead => (
              <LeadCard
                key={lead.id}
                lead={lead}
                noteInput={noteInputs[lead.id] || ''}
                onNoteInput={(val) => setNoteInputs(prev => ({ ...prev, [lead.id]: val }))}
                onUpdateStatus={handleUpdateStatus}
                onAddNote={handleAddNote}
                onDeleteNote={handleDeleteNote}
                onQuote={handleQuoteFromLead}
                onSendToCRM={handleSendToCRM}
                onDelete={handleDeleteLead}
              />
            ))
      )}

      {/* Manual Lead Modal */}
      {showManualModal && (
        <ManualLeadModal
          onSave={handleSaveManualLead}
          onClose={() => setShowManualModal(false)}
        />
      )}
    </div>
  );
}
