import { useState, useRef } from 'react';
import useAppStore from '../state/useAppStore.js';
import { dbUploadLogo, dbUpdateBusiness } from '../db/team.js';

// ─────────────────────────────────────────────────────────────
// OnboardingBrandSetup — Logo upload + brand color picker
// Shown as the first step for Type 1 (new owner) and Type 3
// (existing user creating a second business).
// ─────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { hex: '#2a9db5', label: 'Teal' },
  { hex: '#1a3a4a', label: 'Navy' },
  { hex: '#10b981', label: 'Green' },
  { hex: '#f59e0b', label: 'Amber' },
  { hex: '#ef4444', label: 'Red' },
  { hex: '#8b5cf6', label: 'Purple' },
  { hex: '#3b82f6', label: 'Blue' },
  { hex: '#ec4899', label: 'Pink' },
];

export default function OnboardingBrandSetup({ onComplete, onSkip }) {
  const businessId = useAppStore(s => s.currentBusinessId);
  const fileRef = useRef(null);
  const [logoFile, setLogoFile]       = useState(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [brandColor, setBrandColor]   = useState('#2a9db5');
  const [saving, setSaving]           = useState(false);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function handleColorChange(hex) {
    setBrandColor(hex);
    if (window.applyBrandTheme) window.applyBrandTheme(hex);
  }

  async function handleSave() {
    setSaving(true);
    try {
      // Upload logo if one was selected
      if (logoFile && businessId) {
        const url = await dbUploadLogo(logoFile, businessId);
        window._currentLogoUrl = url;
      }
      // Save brand color
      if (businessId) {
        await dbUpdateBusiness({ brand_color: brandColor }, businessId);
      }
      onComplete();
    } catch (e) {
      console.error('[Onboarding] Brand setup save error:', e);
      onComplete(); // Still advance even if save fails
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10,30,40,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '36px 32px',
        maxWidth: 480, width: '92%', boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🎨</div>
          <h2 style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 22, fontWeight: 900,
            color: '#1a3a4a', margin: '0 0 6px',
          }}>
            Set Up Your Brand
          </h2>
          <p style={{ fontSize: 13, color: '#6b9aaa', fontWeight: 600, margin: 0, lineHeight: 1.5 }}>
            Add your logo and pick a brand color. This will appear on your quotes, invoices, and throughout the app.
          </p>
        </div>

        {/* Logo Upload */}
        <div style={{ marginBottom: 24 }}>
          <label style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--teal-dark, #1a6ea8)', marginBottom: 8, display: 'block',
          }}>
            Business Logo
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 90, height: 90, borderRadius: 14,
              background: '#f1f5f9', border: '2px dashed #cbd5e1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', flexShrink: 0,
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" style={{
                  width: '100%', height: '100%', objectFit: 'contain',
                }} />
              ) : (
                <span style={{ fontSize: 32 }}>📷</span>
              )}
            </div>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: '2px solid var(--teal, #2a9db5)',
                  background: 'var(--offwhite, #f4fbfc)', color: 'var(--teal, #2a9db5)',
                  fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'block',
                }}
              >
                {logoPreview ? '🔄 Change' : '📁 Choose File'}
              </button>
              <p style={{ fontSize: 11, color: '#9ab4bc', fontWeight: 600, marginTop: 6, margin: '6px 0 0' }}>
                PNG, JPG, SVG, or WebP
              </p>
            </div>
          </div>
        </div>

        {/* Brand Color Picker */}
        <div style={{ marginBottom: 28 }}>
          <label style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--teal-dark, #1a6ea8)', marginBottom: 8, display: 'block',
          }}>
            Brand Color
          </label>
          {/* Preset swatches */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            {COLOR_PRESETS.map(c => (
              <button
                key={c.hex}
                onClick={() => handleColorChange(c.hex)}
                title={c.label}
                style={{
                  width: 36, height: 36, borderRadius: 10, border: 'none',
                  background: c.hex, cursor: 'pointer',
                  outline: brandColor === c.hex ? '3px solid #1a3a4a' : '2px solid rgba(0,0,0,0.1)',
                  outlineOffset: brandColor === c.hex ? 2 : 0,
                  transition: 'outline 0.15s',
                }}
              />
            ))}
          </div>
          {/* Custom color input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="color"
              value={brandColor}
              onChange={e => handleColorChange(e.target.value)}
              style={{ width: 44, height: 36, border: 'none', borderRadius: 8, cursor: 'pointer', padding: 0 }}
            />
            <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#1a3a4a' }}>
              {brandColor}
            </span>
            <span style={{ fontSize: 11, color: '#9ab4bc', fontWeight: 600 }}>
              or pick any custom color
            </span>
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            width: '100%', padding: 14, borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, var(--teal, #2a9db5), var(--teal-dark, #1a6ea8))',
            color: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 15, fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? '⏳ Saving...' : '💾 Save & Continue'}
        </button>
        <button
          onClick={onSkip || onComplete}
          style={{
            width: '100%', padding: 10, marginTop: 8, borderRadius: 10,
            border: 'none', background: 'transparent',
            color: '#9ab4bc', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}
