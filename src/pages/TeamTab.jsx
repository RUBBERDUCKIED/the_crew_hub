import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../state/useAppStore.js';
import {
  dbLoadTeamMembers,
  dbAddTeamMember,
  dbUpdateTeamMember,
  dbRemoveTeamMember,
  dbLoadBusinessInfo,
  dbUpdateBusiness,
  dbUploadLogo,
  dbRemoveLogo,
} from '../db/team.js';
import { sendInviteEmail } from '../services/emailService.js';
import { ModalShell, labelStyle, inputStyle } from '../components/shared.jsx';

// ─────────────────────────────────────────────────────────────
// TeamTab — React replacement for renderTeam() + addMemberModal.
// Mirrors the legacy Team tab UI pixel-for-pixel.
// ─────────────────────────────────────────────────────────────

const ROLE_LABEL = { owner: '👑 Owner', dispatcher: '📋 Dispatcher', crew: '🔧 Crew' };
const ROLE_BG    = { owner: '#fef3c7', dispatcher: '#e0f2fe',          crew: '#f0fdf4' };
const ROLE_COLOR = { owner: '#92400e', dispatcher: '#0369a1',          crew: '#065f46' };

function getInitials(name) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function TeamTab() {
  const currentMemberId   = useAppStore(s => s.currentMemberId);
  const currentUserRole   = useAppStore(s => s.currentUserRole);
  const currentBusinessId = useAppStore(s => s.currentBusinessId);
  const isOwner = currentUserRole === 'owner';

  // ── Data state ──────────────────────────────────────────────
  const [members,  setMembers]  = useState([]);
  const [bizInfo,  setBizInfo]  = useState(null);
  const [loading,  setLoading]  = useState(true);

  // ── Add-member modal state ───────────────────────────────────
  const [showModal,    setShowModal]    = useState(false);
  const [modalName,    setModalName]    = useState('');
  const [modalEmail,   setModalEmail]   = useState('');
  const [modalRole,    setModalRole]    = useState('crew');
  const [modalError,   setModalError]   = useState('');
  const [modalSaving,  setModalSaving]  = useState(false);

  // ── Business-info edit state ─────────────────────────────────
  const [bizEdit,      setBizEdit]      = useState({ name: '', email: '', phone: '', address: '' });
  const [bizSaving,    setBizSaving]    = useState(false);
  const [logoUrl,      setLogoUrl]      = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [brandColor,   setBrandColor]   = useState('#2a9db5');
  const [colorSaving,  setColorSaving]  = useState(false);

  // ── Load data ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    const [mems, biz] = await Promise.all([
      dbLoadTeamMembers(currentBusinessId),
      dbLoadBusinessInfo(currentBusinessId),
    ]);
    setMembers(mems);
    setBizInfo(biz);
    if (biz) {
      setBizEdit({
        name:    biz.name    || '',
        email:   biz.email   || '',
        phone:   biz.phone   || '',
        address: biz.address || '',
      });
      setLogoUrl(biz.logo_url || '');
      setBrandColor(biz.brand_color || '#2a9db5');
    }
    setLoading(false);
  }, [currentBusinessId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Modal actions ────────────────────────────────────────────
  function openModal() {
    setModalName(''); setModalEmail(''); setModalRole('crew');
    setModalError(''); setModalSaving(false);
    setShowModal(true);
  }
  function closeModal() { setShowModal(false); }

  async function handleAddMember() {
    const name  = modalName.trim();
    const email = modalEmail.trim();
    if (!name || !email) {
      setModalError('Please enter both name and email.');
      return;
    }
    if (!email.includes('@') || !email.includes('.')) {
      setModalError('Please enter a valid email address.');
      return;
    }
    setModalSaving(true);
    setModalError('');
    try {
      const result = await dbAddTeamMember(name, email, modalRole, currentBusinessId);
      // Send invite email — non-blocking; member is already added if email fails
      dbLoadBusinessInfo(currentBusinessId)
        .then(biz => sendInviteEmail(email, name, modalRole, result.id, biz))
        .then(() => console.log('[CrewHub] Invite email sent to', email))
        .catch(e  => console.warn('[CrewHub] Invite email failed (non-critical):', e));
      setShowModal(false);
      loadData();
    } catch (err) {
      const msg = err?.message || 'Failed to add team member.';
      setModalError(
        (msg.includes('unique') || msg.includes('duplicate'))
          ? 'A team member with this email already exists.'
          : msg
      );
    }
    setModalSaving(false);
  }

  // ── Member management ────────────────────────────────────────
  async function handleToggleActive(memberId, active) {
    try {
      await dbUpdateTeamMember(memberId, { active });
      loadData();
    } catch (e) { alert('Failed to update member: ' + (e.message || e)); }
  }

  async function handleChangeRole(memberId, newRole) {
    if (memberId === currentMemberId) { alert("You can't change your own role."); return; }
    try {
      await dbUpdateTeamMember(memberId, { role: newRole });
      loadData();
    } catch (e) { alert('Failed to change role: ' + (e.message || e)); }
  }

  async function handleRemoveMember(memberId, memberName) {
    if (memberId === currentMemberId) { alert("You can't remove yourself from the team."); return; }
    if (!confirm(`Remove "${memberName}" from your team?\n\nThey will lose access to all business data. This cannot be undone.`)) return;
    try {
      await dbRemoveTeamMember(memberId);
      loadData();
    } catch (e) { alert('Failed to remove member: ' + (e.message || e)); }
  }

  // ── Business info save ───────────────────────────────────────
  async function handleSaveBizInfo() {
    if (!bizEdit.name.trim()) { alert('Business name cannot be empty.'); return; }
    setBizSaving(true);
    try {
      await dbUpdateBusiness(
        {
          name:    bizEdit.name.trim(),
          email:   bizEdit.email.trim(),
          phone:   bizEdit.phone.trim(),
          address: bizEdit.address.trim(),
        },
        currentBusinessId
      );
      alert('✅ Business info saved!');
      loadData();
    } catch (e) { alert('Failed to save: ' + (e.message || e)); }
    setBizSaving(false);
  }

  // ── Logo upload / remove ────────────────────────────────────
  async function handleLogoUpload(file) {
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await dbUploadLogo(file, currentBusinessId);
      setLogoUrl(url);
      // Keep legacy.js documents in sync
      if (typeof window !== 'undefined') window._currentLogoUrl = url;
    } catch (e) {
      alert('Logo upload failed: ' + (e.message || e));
    }
    setLogoUploading(false);
  }

  async function handleLogoRemove() {
    if (!confirm('Remove your business logo?')) return;
    try {
      await dbRemoveLogo(currentBusinessId);
      setLogoUrl('');
      if (typeof window !== 'undefined') window._currentLogoUrl = null;
    } catch (e) {
      alert('Failed to remove logo: ' + (e.message || e));
    }
  }

  // ── Brand color ────────────────────────────────────────────────
  function handleColorPreview(hex) {
    setBrandColor(hex);
    if (window.applyBrandTheme) window.applyBrandTheme(hex);
  }

  async function handleSaveBrandColor() {
    setColorSaving(true);
    try {
      await dbUpdateBusiness({ brand_color: brandColor }, currentBusinessId);
    } catch (e) {
      alert('Failed to save brand color: ' + (e.message || e));
    }
    setColorSaving(false);
  }

  function handleResetColor() {
    const defaultColor = '#2a9db5';
    setBrandColor(defaultColor);
    if (window.applyBrandTheme) window.applyBrandTheme(defaultColor);
  }

  // ── Derived stats ─────────────────────────────────────────────
  const activeCount  = members.filter(m => m.active).length;
  const pendingCount = members.filter(m => !m.authUserId && m.active).length;

  // ── JSX ───────────────────────────────────────────────────────
  return (
    <>
      {/* ── Main content ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px 60px' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--teal-dark)' }}>🏢 Team Management</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>
              {bizInfo?.name || ''}
            </div>
          </div>
          {isOwner && (
            <button className="crm-btn crm-btn-teal" onClick={openModal}>➕ Add Team Member</button>
          )}
        </div>

        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-label">Total Members</div>
            <div className="stat-val">{members.length}</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-label">Active</div>
            <div className="stat-val" style={{ color: '#10b981' }}>{activeCount}</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-label">Pending Invite</div>
            <div className="stat-val" style={{ color: '#f59e0b' }}>{pendingCount}</div>
          </div>
        </div>

        {/* Member list */}
        {loading ? (
          <div className="empty-msg" style={{ background: 'white', borderRadius: 14, padding: 32 }}>Loading team…</div>
        ) : members.length === 0 ? (
          <div className="empty-msg" style={{ background: 'white', borderRadius: 14, padding: 32 }}>No team members yet.</div>
        ) : (
          members.map(m => {
            const isYou      = m.id === currentMemberId;
            const isPending  = !m.authUserId && m.active;
            const isInactive = !m.active;
            const ini        = getInitials(m.name);

            const statusBadge = isPending
              ? <span style={{ fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', borderRadius: 20, padding: '2px 9px' }}>⏳ Pending Invite</span>
              : isInactive
                ? <span style={{ fontSize: 10, fontWeight: 700, background: '#fee2e2', color: '#991b1b', borderRadius: 20, padding: '2px 9px' }}>Deactivated</span>
                : <span style={{ fontSize: 10, fontWeight: 700, background: '#d1fae5', color: '#065f46', borderRadius: 20, padding: '2px 9px' }}>✓ Active</span>;

            const roleEl = isOwner && !isYou
              ? (
                <select
                  value={m.role}
                  onChange={e => handleChangeRole(m.id, e.target.value)}
                  style={{ padding: '5px 10px', border: '2px solid var(--gray)', borderRadius: 8, fontFamily: "'Nunito', sans-serif", fontSize: 12, fontWeight: 700, color: 'var(--text)', background: 'white', cursor: 'pointer' }}
                >
                  <option value="crew">🔧 Crew</option>
                  <option value="dispatcher">📋 Dispatcher</option>
                  <option value="owner">👑 Owner</option>
                </select>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, background: ROLE_BG[m.role] || '#f1f5f9', color: ROLE_COLOR[m.role] || 'var(--text)', borderRadius: 20, padding: '4px 12px' }}>
                  {ROLE_LABEL[m.role] || m.role}
                </span>
              );

            return (
              <div
                key={m.id}
                className="customer-card"
                style={{
                  ...(isInactive ? { borderColor: '#fca5a5', opacity: 0.7 } : isPending ? { borderColor: '#fde047' } : {}),
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', flexWrap: 'wrap' }}>
                  <div className="cust-avatar" style={isInactive ? { background: 'linear-gradient(135deg,#aac4cc,#6b9aaa)' } : {}}>
                    {ini}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>
                      {m.name}
                      {isYou && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--teal)', background: '#e6f6fa', borderRadius: 20, padding: '2px 8px', marginLeft: 6 }}>
                          You
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{m.email}</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                      {statusBadge}
                      {roleEl}
                    </div>
                  </div>
                  {isOwner && !isYou && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {m.active
                        ? <button onClick={() => handleToggleActive(m.id, false)} style={{ background: '#f1f5f9', color: '#6b9aaa', border: '2px solid var(--gray)', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Deactivate</button>
                        : <button onClick={() => handleToggleActive(m.id, true)} style={{ background: '#d1fae5', color: '#065f46', border: '2px solid #86efac', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>Reactivate</button>
                      }
                      <button
                        onClick={() => handleRemoveMember(m.id, m.name)}
                        style={{ background: '#fee2e2', color: '#dc2626', border: '2px solid #fca5a5', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Business Info */}
        <div className="stat-card" style={{ marginTop: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--teal-dark)', marginBottom: 14 }}>🏢 Business Information</div>
          {!bizInfo && !loading && (
            <div style={{ padding: '20px 0', fontSize: 13, fontWeight: 600, color: 'var(--muted)', textAlign: 'center' }}>
              Unable to load business information. Try refreshing the page.
            </div>
          )}
          {bizInfo && (
            isOwner ? (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Business Name', key: 'name',    type: 'text'  },
                    { label: 'Email',          key: 'email',   type: 'email' },
                    { label: 'Phone',          key: 'phone',   type: 'tel'   },
                    { label: 'Address',        key: 'address', type: 'text'  },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{label}</label>
                      <input
                        type={type}
                        value={bizEdit[key]}
                        onChange={e => setBizEdit(prev => ({ ...prev, [key]: e.target.value }))}
                        style={{ width: '100%', padding: '8px 12px', border: '2px solid var(--gray)', borderRadius: 8, fontFamily: "'Nunito', sans-serif", fontSize: 13, fontWeight: 600, color: 'var(--text)', outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleSaveBizInfo}
                  disabled={bizSaving}
                  style={{ marginTop: 14, background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 30, padding: '10px 24px', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 13, cursor: bizSaving ? 'default' : 'pointer' }}
                >
                  {bizSaving ? 'Saving…' : '💾 Save Business Info'}
                </button>

                {/* ── Logo upload ── */}
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>Business Logo</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {logoUrl && (
                      <img
                        src={logoUrl}
                        alt="logo"
                        style={{ height: 64, maxWidth: 160, objectFit: 'contain', borderRadius: 8, border: '2px solid var(--gray)', background: '#f8fafc', padding: 4 }}
                      />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{
                        display: 'inline-block', background: 'var(--teal)', color: 'white',
                        borderRadius: 30, padding: '8px 18px', fontSize: 12, fontWeight: 800,
                        cursor: logoUploading ? 'default' : 'pointer', opacity: logoUploading ? 0.7 : 1,
                        fontFamily: "'Nunito', sans-serif",
                      }}>
                        {logoUploading ? 'Uploading…' : (logoUrl ? '🔄 Change Logo' : '📷 Upload Logo')}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          style={{ display: 'none' }}
                          disabled={logoUploading}
                          onChange={e => { if (e.target.files[0]) handleLogoUpload(e.target.files[0]); e.target.value = ''; }}
                        />
                      </label>
                      {logoUrl && (
                        <button
                          onClick={handleLogoRemove}
                          style={{ background: '#fee2e2', color: '#dc2626', border: '2px solid #fca5a5', borderRadius: 30, padding: '6px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
                        >
                          🗑 Remove
                        </button>
                      )}
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>PNG, JPG, SVG, WebP · appears on quotes &amp; invoices</span>
                    </div>
                  </div>
                </div>

                {/* ── Brand colour picker ── */}
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', marginBottom: 10 }}>Brand Color</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <div style={{ position: 'relative', width: 48, height: 48 }}>
                      <input
                        type="color"
                        value={brandColor}
                        onChange={e => handleColorPreview(e.target.value)}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none', padding: 0, cursor: 'pointer', borderRadius: 10, overflow: 'hidden' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace' }}>{brandColor}</div>
                      <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>Pick a colour — the app recolours live as you drag</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                      <button
                        onClick={handleResetColor}
                        style={{ background: '#f1f5f9', color: 'var(--muted)', border: '2px solid var(--gray)', borderRadius: 30, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: "'Nunito', sans-serif" }}
                      >
                        Reset
                      </button>
                      <button
                        onClick={handleSaveBrandColor}
                        disabled={colorSaving}
                        style={{ background: brandColor, color: 'white', border: 'none', borderRadius: 30, padding: '6px 16px', fontSize: 11, fontWeight: 800, cursor: colorSaving ? 'default' : 'pointer', fontFamily: "'Nunito', sans-serif", transition: 'background .15s' }}
                      >
                        {colorSaving ? 'Saving…' : '💾 Save Color'}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{bizInfo.name || 'Unnamed Business'}</div>
                {bizInfo.email   && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 4 }}>{bizInfo.email}</div>}
                {bizInfo.phone   && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{bizInfo.phone}</div>}
                {bizInfo.address && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)', marginTop: 2 }}>{bizInfo.address}</div>}
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Add Member Modal ── */}
      {showModal && (
        <ModalShell
          title="➕ Add Team Member"
          subtitle="They'll sign up with this email to join your team"
          onClose={closeModal}
        >
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                value={modalName}
                onChange={e => setModalName(e.target.value)}
                placeholder="Marcus Silva"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Email Address</label>
              <input
                type="email"
                value={modalEmail}
                onChange={e => setModalEmail(e.target.value)}
                placeholder="marcus@email.com"
                style={inputStyle}
              />
              <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 600, marginTop: 4 }}>They must sign up with this exact email to join your team.</div>
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <select
                value={modalRole}
                onChange={e => setModalRole(e.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="crew">🔧 Crew — Can see their assigned jobs only</option>
                <option value="dispatcher">📋 Dispatcher — Can manage all jobs and team schedule</option>
                <option value="owner">👑 Owner — Full access to everything</option>
              </select>
            </div>
            {modalError && (
              <div style={{ background: '#fef2f2', color: '#dc2626', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 700 }}>
                {modalError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button
                onClick={handleAddMember}
                disabled={modalSaving}
                style={{ flex: 1, background: 'var(--teal)', color: 'white', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, cursor: modalSaving ? 'default' : 'pointer' }}
              >
                {modalSaving ? 'Adding…' : '➕ Add Member'}
              </button>
              <button
                onClick={closeModal}
                style={{ flex: 1, background: '#f1f5f9', color: 'var(--text)', border: 'none', borderRadius: 30, padding: 12, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  );
}
