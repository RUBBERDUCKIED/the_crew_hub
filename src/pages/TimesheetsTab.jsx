import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../state/useAppStore.js';
import { dbLoadTeamMembers } from '../db/team.js';
import {
  dbGetAllTimeEntries,
  dbGetAllActiveClockIns,
  dbEditTimeEntry,
  dbAddManualTimeEntry,
} from '../db/timeEntries.js';
import { canAccess } from '../db/auth.js';
import { formatHM, formatTime, formatDateLabel } from '../helpers/formatting.js';
import { ModalShell, labelStyle, inputStyle } from '../components/shared.jsx';

// ─────────────────────────────────────────────────────────────
// TimesheetsTab — Fresh React build. No legacy equivalent.
// Shows all team members' hours for a selected date range,
// live clock status, per-employee breakdowns, entry editing,
// manual entry creation, and payroll CSV export.
// Owner + dispatcher only.
// ─────────────────────────────────────────────────────────────

const OVERTIME_THRESHOLD_HOURS = 40;

// ── Reusable time entry modal (used for both Edit and Add) ────
function TimeEntryModal({ title, subtitle, inVal, outVal, breakVal, error, saving,
  onChangeIn, onChangeOut, onChangeBreak, onSave, onCancel }) {
  return (
    <ModalShell title={title} subtitle={subtitle} onClose={onCancel} style={{ zIndex: 1200 }}>
        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Clock In */}
          <div>
            <label style={labelStyle}>Clock In *</label>
            <input type="datetime-local" value={inVal} onChange={e => onChangeIn(e.target.value)} style={inputStyle} />
          </div>
          {/* Clock Out */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Clock Out</label>
              {outVal && (
                <button
                  onClick={() => onChangeOut('')}
                  style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde047', borderRadius: 20, padding: '2px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
                >
                  ↩ Still working (clear)
                </button>
              )}
            </div>
            <input type="datetime-local" value={outVal} onChange={e => onChangeOut(e.target.value)} style={inputStyle} />
            <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>
              {outVal ? 'Clocked out at this time.' : '⏱ No clock-out — employee is still active.'}
            </div>
          </div>
          {/* Break */}
          <div>
            <label style={labelStyle}>Break (minutes)</label>
            <input
              type="number" min="0" value={breakVal}
              onChange={e => onChangeBreak(parseInt(e.target.value) || 0)}
              style={inputStyle}
            />
          </div>
          {/* Error */}
          {error && (
            <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>
              {error}
            </div>
          )}
          {/* Actions */}
          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button
              onClick={onSave}
              disabled={saving}
              style={{ flex: 1, background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, cursor: saving ? 'default' : 'pointer' }}
            >
              {saving ? 'Saving…' : '💾 Save'}
            </button>
            <button
              onClick={onCancel}
              style={{ flex: 1, background: '#f1f5f9', color: 'var(--text)', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
    </ModalShell>
  );
}

export default function TimesheetsTab() {
  const currentUserRole   = useAppStore(s => s.currentUserRole);
  const currentMemberId   = useAppStore(s => s.currentMemberId);
  const currentBusinessId = useAppStore(s => s.currentBusinessId);

  // ── Range state ───────────────────────────────────────────────
  const [rangeMode,   setRangeMode]   = useState('thisweek');
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');

  // ── Data state ────────────────────────────────────────────────
  const [members,      setMembers]      = useState([]);
  const [entries,      setEntries]      = useState([]);
  const [activeClocks, setActiveClocks] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedId,   setExpandedId]   = useState(null);

  // ── Edit modal state ──────────────────────────────────────────
  const [editEntry,  setEditEntry]  = useState(null); // { ...entry, memberName }
  const [editIn,     setEditIn]     = useState('');
  const [editOut,    setEditOut]    = useState('');
  const [editBreak,  setEditBreak]  = useState(0);
  const [editError,  setEditError]  = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // ── Add-entry modal state ─────────────────────────────────────
  const [addModal,   setAddModal]   = useState(null); // { member }
  const [addIn,      setAddIn]      = useState('');
  const [addOut,     setAddOut]     = useState('');
  const [addBreak,   setAddBreak]   = useState(0);
  const [addError,   setAddError]   = useState('');
  const [addSaving,  setAddSaving]  = useState(false);

  // ── Date range calculation ────────────────────────────────────
  function getDateRange() {
    const now       = new Date();
    const dayOfWeek = now.getDay();
    const mondayOff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    if (rangeMode === 'thisweek') {
      const mon = new Date(now); mon.setDate(now.getDate() + mondayOff); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon.toISOString().slice(0,10), end: sun.toISOString().slice(0,10), label: 'This Week' };
    }
    if (rangeMode === 'lastweek') {
      const mon = new Date(now); mon.setDate(now.getDate() + mondayOff - 7); mon.setHours(0,0,0,0);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      return { start: mon.toISOString().slice(0,10), end: sun.toISOString().slice(0,10), label: 'Last Week' };
    }
    if (rangeMode === 'thismonth') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        start: s.toISOString().slice(0,10),
        end:   e.toISOString().slice(0,10),
        label: now.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
      };
    }
    return {
      start: customStart || now.toISOString().slice(0,10),
      end:   customEnd   || now.toISOString().slice(0,10),
      label: 'Custom Range',
    };
  }

  // ── Load data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!canAccess('timesheets', currentUserRole)) return;
    setLoading(true);
    const { start, end } = getDateRange();
    const [m, e, ac] = await Promise.all([
      dbLoadTeamMembers(currentBusinessId),
      dbGetAllTimeEntries(start, end),
      dbGetAllActiveClockIns(),
    ]);
    setMembers(m);
    setEntries(e);
    setActiveClocks(ac);
    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBusinessId, rangeMode, customStart, customEnd, currentUserRole]);

  useEffect(() => {
    if (currentBusinessId) loadData();
  }, [currentBusinessId, loadData]);

  // ── Local helper (datetime-local input value formatter) ──────
  const toLocalDT  = d   => {
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const h  = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${dd}T${h}:${mi}`;
  };

  // ── Per-member aggregation ────────────────────────────────────
  const activeMembers = members.filter(m => m.active);
  const clockedInIds  = new Set(activeClocks.map(e => e.member_id));
  const { start, end, label: rangeLabel } = getDateRange();

  const memberData = activeMembers.map(m => {
    const mEntries = entries.filter(e => e.member_id === m.id);
    let totalMins = 0, totalBreak = 0;
    mEntries.forEach(e => {
      const inT  = new Date(e.clock_in).getTime();
      const outT = e.clock_out ? new Date(e.clock_out).getTime() : Date.now();
      totalMins  += Math.max(0, (outT - inT) / 60000 - (e.break_mins || 0));
      totalBreak += e.break_mins || 0;
    });
    const totalHours = totalMins / 60;
    const regular    = Math.min(totalHours, OVERTIME_THRESHOLD_HOURS);
    const overtime   = Math.max(0, totalHours - OVERTIME_THRESHOLD_HOURS);
    return { member: m, entries: mEntries, totalMins, totalHours, regular, overtime, totalBreak };
  });

  const totalHoursAll = memberData.reduce((s, d) => s + d.totalHours, 0);
  const overtimeCount = memberData.filter(d => d.overtime > 0).length;

  // ── Edit handlers ─────────────────────────────────────────────
  function openEdit(entry, memberName) {
    setEditEntry({ ...entry, memberName });
    setEditIn(toLocalDT(new Date(entry.clock_in)));
    setEditOut(entry.clock_out ? toLocalDT(new Date(entry.clock_out)) : '');
    setEditBreak(entry.break_mins || 0);
    setEditError('');
    setEditSaving(false);
  }

  async function saveEdit() {
    if (!editIn) { setEditError('Clock-in time is required.'); return; }
    if (editOut && new Date(editOut) <= new Date(editIn)) {
      setEditError('Clock-out must be after clock-in.');
      return;
    }
    setEditSaving(true);
    const updates = {
      clock_in:   new Date(editIn).toISOString(),
      clock_out:  editOut ? new Date(editOut).toISOString() : null,
      break_mins: editBreak,
    };
    try {
      await dbEditTimeEntry(editEntry.id, updates, currentMemberId);
      setEditEntry(null);
      await loadData();
    } catch (e) { setEditError('Save failed: ' + (e.message || e)); }
    setEditSaving(false);
  }

  // ── Add-entry handlers ────────────────────────────────────────
  function openAddModal(member) {
    setAddModal({ member });
    setAddIn('');
    setAddOut('');
    setAddBreak(0);
    setAddError('');
    setAddSaving(false);
  }

  async function handleAddEntry() {
    if (!addIn) { setAddError('Clock-in time is required.'); return; }
    if (addOut && new Date(addOut) <= new Date(addIn)) {
      setAddError('Clock-out must be after clock-in.');
      return;
    }
    setAddSaving(true);
    setAddError('');
    try {
      await dbAddManualTimeEntry(
        addModal.member.id,
        currentBusinessId,
        new Date(addIn).toISOString(),
        addOut ? new Date(addOut).toISOString() : null,
        addBreak,
        currentMemberId,
      );
      setAddModal(null);
      // Auto-expand the card so the new entry is immediately visible
      setExpandedId(addModal.member.id);
      await loadData();
    } catch (e) { setAddError('Failed to add entry: ' + (e.message || e)); }
    setAddSaving(false);
  }

  // ── Payroll CSV export ────────────────────────────────────────
  function exportCSV() {
    const header = ['Employee', 'Email', 'Role', 'Period Start', 'Period End', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Break Hours', 'Entries'];
    const rows = memberData.map(({ member: m, totalHours, regular, overtime, totalBreak, entries: e }) => [
      m.name, m.email, m.role, start, end,
      totalHours.toFixed(2), regular.toFixed(2), overtime.toFixed(2),
      (totalBreak / 60).toFixed(2), e.length,
    ]);
    const csv  = [header, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `CrewHub_Payroll_${start}_to_${end}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ── Filter button style ───────────────────────────────────────
  const filterBtn = mode => ({
    padding: '7px 16px', border: '2px solid var(--gray)', borderRadius: 20,
    fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer',
    background: rangeMode === mode ? 'var(--teal)' : 'white',
    color:      rangeMode === mode ? 'white'       : 'var(--text)',
  });

  // ── Access guard ──────────────────────────────────────────────
  if (!canAccess('timesheets', currentUserRole)) return null;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px 60px' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal-dark)' }}>⏱ Timesheets</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>Manage team hours and payroll</div>
        </div>
        <button
          onClick={exportCSV}
          style={{ background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 30, padding: '10px 22px', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer' }}
        >
          📥 Export Payroll CSV
        </button>
      </div>

      {/* ── Date range filters ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
        <button onClick={() => setRangeMode('thisweek')}  style={filterBtn('thisweek')}>This Week</button>
        <button onClick={() => setRangeMode('lastweek')}  style={filterBtn('lastweek')}>Last Week</button>
        <button onClick={() => setRangeMode('thismonth')} style={filterBtn('thismonth')}>This Month</button>
        <button onClick={() => setRangeMode('custom')}    style={filterBtn('custom')}>Custom</button>
        {rangeMode === 'custom' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              style={{ padding: '7px 12px', border: '2px solid var(--gray)', borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
            />
            <span style={{ color: 'var(--muted)', fontWeight: 700 }}>to</span>
            <input
              type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              style={{ padding: '7px 12px', border: '2px solid var(--gray)', borderRadius: 10, fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none' }}
            />
          </div>
        )}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>Loading timesheets…</div>
      ) : (
        <>
          {/* ── Live Crew Status ── */}
          <div style={{ background: 'white', borderRadius: 14, border: '2px solid var(--gray)', padding: '14px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--teal-dark)', marginBottom: 10 }}>🟢 Live Crew Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {activeMembers.length === 0 ? (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>No active team members.</div>
              ) : activeMembers.map(m => {
                const isClockedIn = clockedInIds.has(m.id);
                const activeEntry = activeClocks.find(e => e.member_id === m.id);
                const elapsedMins = activeEntry
                  ? Math.floor((Date.now() - new Date(activeEntry.clock_in).getTime()) / 60000)
                  : 0;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background:   isClockedIn ? '#f0fdf4'   : '#f8fafc',
                      border:       `2px solid ${isClockedIn ? '#86efac' : '#e2e8f0'}`,
                      borderRadius: 10, padding: '8px 14px',
                    }}
                  >
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                      background:  isClockedIn ? '#10b981' : '#d1d5db',
                      ...(isClockedIn ? { boxShadow: '0 0 6px #10b981' } : {}),
                    }} />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text)' }}>{m.name}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: isClockedIn ? '#059669' : 'var(--muted)' }}>
                        {isClockedIn
                          ? `${Math.floor(elapsedMins / 60)}h ${elapsedMins % 60}m`
                          : 'Not clocked in'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Summary Stats ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Period</div>
              <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)' }}>{rangeLabel}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{start} → {end}</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Total Team Hours</div>
              <div className="stat-val" style={{ color: 'var(--teal-dark)' }}>{totalHoursAll.toFixed(1)}</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Time Entries</div>
              <div className="stat-val">{entries.length}</div>
            </div>
            <div className="stat-card" style={{ textAlign: 'center' }}>
              <div className="stat-label">Overtime Flagged</div>
              <div className="stat-val" style={{ color: overtimeCount > 0 ? '#dc2626' : '#10b981' }}>{overtimeCount}</div>
            </div>
          </div>

          {/* ── Per-Employee Cards ── */}
          {memberData.length === 0 ? (
            <div style={{ background: 'white', borderRadius: 14, padding: 32, textAlign: 'center', color: 'var(--muted)', fontWeight: 700 }}>
              No active team members.
            </div>
          ) : memberData.map(({ member: m, entries: mEntries, totalHours, regular, overtime }) => {
            const initials    = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            const isExpanded  = expandedId === m.id;
            const hasOvertime = overtime > 0;

            return (
              <div
                key={m.id}
                className="customer-card"
                style={{ marginBottom: 14, ...(hasOvertime ? { borderColor: '#fca5a5' } : {}) }}
              >
                {/* ── Card header (click to expand) ── */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', gap: 12, flexWrap: 'wrap' }}>
                  {/* Avatar + name — clickable expand area */}
                  <div
                    className="customer-header"
                    onClick={() => setExpandedId(isExpanded ? null : m.id)}
                    style={{ cursor: 'pointer', flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, padding: 0, border: 'none', background: 'none' }}
                  >
                    <div className="cust-avatar">{initials}</div>
                    <div className="cust-info" style={{ flex: 1, minWidth: 0 }}>
                      <div className="cust-name">{m.name}</div>
                      <div className="cust-meta">{m.email} · {m.role}</div>
                    </div>
                    <div className="cust-stats">
                      <div className="cust-stat">
                        <div className="cust-stat-val" style={{ color: 'var(--teal-dark)' }}>{totalHours.toFixed(1)}</div>
                        <div className="cust-stat-lbl">Hours</div>
                      </div>
                      <div className="cust-stat">
                        <div className="cust-stat-val">{regular.toFixed(1)}</div>
                        <div className="cust-stat-lbl">Regular</div>
                      </div>
                      <div className="cust-stat">
                        <div className="cust-stat-val" style={{ color: hasOvertime ? '#dc2626' : '#10b981' }}>
                          {overtime.toFixed(1)}
                        </div>
                        <div className="cust-stat-lbl">Overtime</div>
                      </div>
                    </div>
                    <div className="cust-chevron">{isExpanded ? '▲' : '▼'}</div>
                  </div>
                  {/* ── Add Entry button — always visible, never triggers expand ── */}
                  <button
                    onClick={e => { e.stopPropagation(); openAddModal(m); }}
                    style={{ background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 20, padding: '7px 16px', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    ➕ Add Entry
                  </button>
                </div>

                {/* ── Expanded entry list ── */}
                {isExpanded && (
                  <div className="customer-body" style={{ borderTop: '2px solid var(--gray)' }}>
                    <div style={{ padding: '16px 20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div className="notes-label" style={{ margin: 0 }}>
                          Time Entries {mEntries.length > 0 && <span style={{ fontWeight: 600, color: 'var(--muted)' }}>({mEntries.length})</span>}
                        </div>
                      </div>
                      {mEntries.length === 0 ? (
                        <div style={{ padding: '20px 12px', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textAlign: 'center', background: '#f8fafc', borderRadius: 10 }}>
                          No entries for this period.{' '}
                          <button
                            onClick={() => openAddModal(m)}
                            style={{ background: 'none', border: 'none', color: 'var(--teal)', fontWeight: 800, fontSize: 13, cursor: 'pointer', padding: 0 }}
                          >
                            Add one now →
                          </button>
                        </div>
                      ) : mEntries.map(e => {
                        const workedMins = e.clock_out
                          ? Math.max(0, (new Date(e.clock_out) - new Date(e.clock_in)) / 60000 - (e.break_mins || 0))
                          : Math.max(0, (Date.now() - new Date(e.clock_in).getTime()) / 60000 - (e.break_mins || 0));
                        const isActive = !e.clock_out;
                        return (
                          <div
                            key={e.id}
                            style={{
                              background:   isActive ? '#f0fdf4' : '#f4fbfc',
                              border:       `1px solid ${isActive ? '#86efac' : '#e0f2fe'}`,
                              borderRadius: 10,
                              padding:      '10px 14px',
                              marginBottom: 6,
                            }}
                          >
                            {/* Row 1 — date, duration, badges, edit button */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--muted)', flex: 1 }}>
                                {formatDateLabel(e.clock_in)}
                              </span>
                              <span style={{ fontWeight: 900, fontSize: 14, color: 'var(--teal-dark)' }}>
                                {formatHM(workedMins)}
                              </span>
                              {e.edited_by && (
                                <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', background: '#fef3c7', borderRadius: 10, padding: '1px 7px' }}>
                                  Edited
                                </span>
                              )}
                              <button
                                onClick={() => openEdit(e, m.name)}
                                style={{ background: 'white', color: 'var(--teal-dark)', border: '2px solid var(--gray)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}
                              >
                                ✏️ Edit
                              </button>
                            </div>
                            {/* Row 2 — IN time → OUT time · break */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 10, fontWeight: 800, color: 'white', background: 'var(--teal)', borderRadius: 5, padding: '1px 6px', letterSpacing: '0.04em' }}>IN</span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{formatTime(e.clock_in)}</span>
                              <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 700, margin: '0 2px' }}>→</span>
                              <span style={{ fontSize: 10, fontWeight: 800, color: 'white', background: isActive ? '#10b981' : '#6b9aaa', borderRadius: 5, padding: '1px 6px', letterSpacing: '0.04em' }}>
                                {isActive ? 'NOW' : 'OUT'}
                              </span>
                              {isActive
                                ? <span style={{ fontSize: 13, fontWeight: 800, color: '#059669' }}>⏱ Still clocked in</span>
                                : <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{formatTime(e.clock_out)}</span>
                              }
                              {e.break_mins > 0 && (
                                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginLeft: 4 }}>
                                  · {e.break_mins}m break
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* ── Edit Time Entry Modal ── */}
      {editEntry && (
        <TimeEntryModal
          title="✏️ Edit Time Entry"
          subtitle={editEntry.memberName}
          inVal={editIn}
          outVal={editOut}
          breakVal={editBreak}
          error={editError}
          saving={editSaving}
          onChangeIn={setEditIn}
          onChangeOut={setEditOut}
          onChangeBreak={setEditBreak}
          onSave={saveEdit}
          onCancel={() => setEditEntry(null)}
        />
      )}

      {/* ── Add Time Entry Modal ── */}
      {addModal && (
        <TimeEntryModal
          title="➕ Add Time Entry"
          subtitle={addModal.member.name}
          inVal={addIn}
          outVal={addOut}
          breakVal={addBreak}
          error={addError}
          saving={addSaving}
          onChangeIn={setAddIn}
          onChangeOut={setAddOut}
          onChangeBreak={setAddBreak}
          onSave={handleAddEntry}
          onCancel={() => setAddModal(null)}
        />
      )}
    </div>
  );
}
