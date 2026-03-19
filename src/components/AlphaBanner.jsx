import useAppStore from '../state/useAppStore.js';

// ─────────────────────────────────────────────────────────────
// AlphaBanner — sticky notification bar shown to alpha users.
// Renders at the very top of #react-root (above the hero).
// Disappears automatically once the business is on a paid plan.
// ─────────────────────────────────────────────────────────────

export default function AlphaBanner() {
  const plan      = useAppStore(s => s.businessPlan);
  const isSignedIn = useAppStore(s => s.isSignedIn);

  // Only show for signed-in alpha users
  if (!isSignedIn || plan !== 'alpha') return null;

  return (
    <div style={{
      background:     'linear-gradient(135deg, #f0d000, #f59e0b)',
      padding:        '8px 20px',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            8,
      fontFamily:     "'Nunito', sans-serif",
      fontSize:       13,
      fontWeight:     800,
      color:          '#1a3a4a',
      position:       'sticky',
      top:            0,
      zIndex:         900,
    }}>
      <span style={{ fontSize: 16 }}>🧪</span>
      <span>You&apos;re on the free Alpha — thanks for testing! All features are unlocked.</span>
    </div>
  );
}
