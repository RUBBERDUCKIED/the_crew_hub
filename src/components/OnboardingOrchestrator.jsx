import { useState, useEffect, useCallback } from 'react';
import useAppStore from '../state/useAppStore.js';
import { dbMarkOnboardingComplete } from '../db/team.js';
import OnboardingBrandSetup from './OnboardingBrandSetup.jsx';
import OnboardingWelcome from './OnboardingWelcome.jsx';
import OnboardingWalkthrough from './OnboardingWalkthrough.jsx';

// ─────────────────────────────────────────────────────────────
// OnboardingOrchestrator — State machine for the 3 onboarding types
//
// Type 1 (new owner, first business):
//   brand-setup → welcome → walkthrough → complete
//
// Type 2 (invited team member):
//   welcome → walkthrough → complete
//
// Type 3 (existing user, new business):
//   brand-setup → finish (welcome message only, no tutorial)
//
// Listens for 'crewhub:start-onboarding' custom event from legacy.js.
// ─────────────────────────────────────────────────────────────

function detectOnboardingType({ role, isNewBusiness, hasOtherMemberships }) {
  if (isNewBusiness && (role === 'owner' || role === 'admin') && !hasOtherMemberships) return 1;
  if (isNewBusiness && (role === 'owner' || role === 'admin') && hasOtherMemberships) return 3;
  return 2; // Invited member (crew, dispatcher, admin invited to existing business)
}

const PHASE_SEQUENCE = {
  1: ['brand-setup', 'welcome', 'walkthrough', 'finish'],
  2: ['welcome', 'walkthrough', 'finish'],
  3: ['brand-setup', 'finish'],
};

export default function OnboardingOrchestrator() {
  const [phase, setPhase]               = useState(null);   // current phase name
  const [onboardingType, setType]        = useState(null);   // 1, 2, or 3
  const [role, setRole]                  = useState('owner');
  const [memberId, setMemberId]          = useState(null);
  const [phaseIndex, setPhaseIndex]      = useState(0);
  const setOnboardingCompleted = useAppStore(s => s.setOnboardingCompleted);

  // Listen for the start event from legacy.js
  useEffect(() => {
    function handleStart(e) {
      const detail = e.detail;
      if (!detail) return;
      const type = detectOnboardingType(detail);
      const sequence = PHASE_SEQUENCE[type];
      setType(type);
      setRole(detail.role || 'owner');
      setMemberId(detail.memberId);
      setPhaseIndex(0);
      setPhase(sequence[0]);
    }
    window.addEventListener('crewhub:start-onboarding', handleStart);
    return () => window.removeEventListener('crewhub:start-onboarding', handleStart);
  }, []);

  // Advance to the next phase in the sequence
  const advancePhase = useCallback(() => {
    if (!onboardingType) return;
    const sequence = PHASE_SEQUENCE[onboardingType];
    const nextIdx = phaseIndex + 1;
    if (nextIdx >= sequence.length) {
      // All done
      completeOnboarding();
    } else {
      setPhaseIndex(nextIdx);
      setPhase(sequence[nextIdx]);
    }
  }, [onboardingType, phaseIndex]);

  // Mark onboarding complete in DB + store
  const completeOnboarding = useCallback(async () => {
    setPhase(null);
    setType(null);
    if (memberId) {
      try { await dbMarkOnboardingComplete(memberId); } catch(e) { console.warn(e); }
    }
    setOnboardingCompleted(true);
  }, [memberId, setOnboardingCompleted]);

  // Skip = jump straight to complete
  const handleSkip = useCallback(() => {
    completeOnboarding();
  }, [completeOnboarding]);

  // Render nothing if no onboarding active
  if (!phase || !onboardingType) return null;

  // Finish phase — brief "all done" card
  if (phase === 'finish') {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(10,30,40,0.85)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'Nunito', sans-serif",
      }}>
        <div style={{
          background: '#fff', borderRadius: 20, padding: '44px 36px',
          maxWidth: 440, width: '90%', textAlign: 'center',
          boxShadow: '0 12px 48px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontSize: 56, marginBottom: 12 }}>🎉</div>
          <h2 style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 24, fontWeight: 900,
            color: '#1a3a4a', margin: '0 0 10px',
          }}>
            You're All Set!
          </h2>
          <p style={{
            fontSize: 14, color: '#4a7a8a', fontWeight: 600,
            lineHeight: 1.6, margin: '0 0 28px',
          }}>
            Enjoy your business, run simpler.
          </p>
          <button
            onClick={completeOnboarding}
            style={{
              width: '100%', padding: 15, borderRadius: 12, border: 'none',
              background: 'linear-gradient(135deg, var(--teal, #2a9db5), var(--teal-dark, #1a6ea8))',
              color: '#fff', fontFamily: "'Nunito', sans-serif", fontSize: 16, fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Get Started →
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {phase === 'brand-setup' && (
        <OnboardingBrandSetup
          onComplete={advancePhase}
          onSkip={advancePhase}
        />
      )}
      {phase === 'welcome' && (
        <OnboardingWelcome
          role={role}
          onStartTour={advancePhase}
          onSkip={handleSkip}
        />
      )}
      {phase === 'walkthrough' && (
        <OnboardingWalkthrough
          role={role}
          onComplete={advancePhase}
        />
      )}
    </>
  );
}
