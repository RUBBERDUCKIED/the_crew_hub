import useAppStore from '../state/useAppStore.js';

// ─────────────────────────────────────────────────────────────
// OnboardingWelcome — Role-tailored welcome modal
// Shown before the guided walkthrough for Types 1 and 2.
// ─────────────────────────────────────────────────────────────

const WELCOME_CONTENT = {
  owner: {
    emoji: '🚀',
    title: 'Welcome to The Crew Hub!',
    subtitle: "Your business platform is ready. Let's take a quick tour so you know where everything is.",
    cta: "Let's Go!",
  },
  admin: {
    emoji: '🛡️',
    title: 'Welcome to The Crew Hub!',
    subtitle: "You've been set up as an Admin. Let's walk through the tools you'll be using.",
    cta: "Let's Go!",
  },
  dispatcher: {
    emoji: '📋',
    title: 'Welcome to the team!',
    subtitle: "You've been added as a Dispatcher. Let us show you the tools you'll be working with every day.",
    cta: 'Show Me Around',
  },
  crew: {
    emoji: '🔧',
    title: 'Welcome to the team!',
    subtitle: "You've been added as Crew. Let's do a quick walkthrough of your daily tools.",
    cta: 'Show Me Around',
  },
};

export default function OnboardingWelcome({ role, onStartTour, onSkip }) {
  const content = WELCOME_CONTENT[role] || WELCOME_CONTENT.crew;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99999,
      background: 'rgba(10,30,40,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Nunito', sans-serif",
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, padding: '40px 36px',
        maxWidth: 440, width: '90%', textAlign: 'center',
        boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
      }}>
        <div style={{ fontSize: 56, marginBottom: 12 }}>{content.emoji}</div>
        <h2 style={{
          fontFamily: "'Montserrat', sans-serif", fontSize: 24, fontWeight: 900,
          color: '#1a3a4a', margin: '0 0 10px',
        }}>
          {content.title}
        </h2>
        <p style={{
          fontSize: 14, color: '#4a7a8a', fontWeight: 600,
          lineHeight: 1.6, margin: '0 0 28px',
        }}>
          {content.subtitle}
        </p>

        <button
          onClick={onStartTour}
          style={{
            width: '100%', padding: 15, borderRadius: 12, border: 'none',
            background: 'linear-gradient(135deg, var(--teal, #2a9db5), var(--teal-dark, #1a6ea8))',
            color: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 800,
            cursor: 'pointer', marginBottom: 8,
          }}
        >
          {content.cta} →
        </button>
        <button
          onClick={onSkip}
          style={{
            width: '100%', padding: 10, borderRadius: 10,
            border: 'none', background: 'transparent',
            color: '#9ab4bc', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Skip Tutorial
        </button>
      </div>
    </div>
  );
}
