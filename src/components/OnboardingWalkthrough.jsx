import { useState, useEffect, useCallback, useRef } from 'react';

// ─────────────────────────────────────────────────────────────
// OnboardingWalkthrough — Spotlight overlay + step-by-step tour
// Uses box-shadow trick to create dark overlay with cutout.
// Switches tabs via window.switchTab() to walk through each one.
// ─────────────────────────────────────────────────────────────

const STEPS = {
  owner: [
    {
      tab: 'today',
      selector: '[data-tab="today"]',
      title: '📍 Today',
      desc: "Your daily dashboard. See today's scheduled jobs, weather conditions, revenue at a glance, and your route map. Clock in and out right from here.",
    },
    {
      tab: 'leads',
      selector: '[data-tab="leads"]',
      title: '🎯 Lead Pipeline',
      desc: 'Track and manage incoming leads. Move them through stages from new to converted, and turn them into quoted jobs with one click.',
    },
    {
      tab: 'quotes',
      selector: '[data-tab="quotes"]',
      title: '📋 Quoting',
      desc: 'Build professional quotes with your custom pricing. Email them directly to customers, download as PDF, or print — all branded with your logo and colors.',
    },
    {
      tab: 'pipeline',
      selector: '[data-tab="pipeline"]',
      title: '⚡ Job Pipeline',
      desc: "Manage all your jobs from scheduled through to completed. Drag and drop to reschedule, and track every job's status at a glance.",
    },
    {
      tab: 'crm',
      selector: '[data-tab="crm"]',
      title: '👥 CRM',
      desc: 'Your customer database. Store contact info, add notes, track job history, and manage photos for each property.',
    },
    {
      tab: 'reports',
      selector: '[data-tab="reports"]',
      title: '📊 Reports',
      desc: 'Revenue reports, job statistics, and business analytics. See how your business is performing over time.',
    },
    {
      tab: 'timesheets',
      selector: '[data-tab="timesheets"]',
      title: '⏱️ Timesheets',
      desc: 'Track hours for you and your team. View daily breakdowns and export to CSV for payroll.',
    },
    {
      tab: 'team',
      selector: '[data-tab="team"]',
      title: '👥 Team',
      desc: 'Manage team members and their roles. Update your business info, logo, and brand color. Invite new crew and dispatchers.',
    },
  ],
  // Admin gets the same walkthrough as owner
  get admin() { return this.owner; },

  dispatcher: [
    {
      tab: 'today',
      selector: '[data-tab="today"]',
      title: '📍 Today',
      desc: "Your daily dashboard. See today's scheduled jobs, weather conditions, and the route map.",
    },
    {
      tab: 'leads',
      selector: '[data-tab="leads"]',
      title: '🎯 Lead Pipeline',
      desc: 'Track and manage incoming leads. Move them through stages and convert them into jobs.',
    },
    {
      tab: 'quotes',
      selector: '[data-tab="quotes"]',
      title: '📋 Quoting',
      desc: 'Build and send professional quotes to customers. Email or download as PDF.',
    },
    {
      tab: 'pipeline',
      selector: '[data-tab="pipeline"]',
      title: '⚡ Job Pipeline',
      desc: 'Manage all jobs from scheduled through completed. Keep everything organized.',
    },
    {
      tab: 'crm',
      selector: '[data-tab="crm"]',
      title: '👥 CRM',
      desc: 'Your customer database. Store contacts, notes, and job history.',
    },
    {
      tab: 'reports',
      selector: '[data-tab="reports"]',
      title: '📊 Reports',
      desc: 'View revenue reports and business analytics.',
    },
    {
      tab: 'timesheets',
      selector: '[data-tab="timesheets"]',
      title: '⏱️ Timesheets',
      desc: 'Track hours for the team. View daily breakdowns.',
    },
  ],

  crew: [
    {
      tab: 'today',
      selector: '[data-tab="today"]',
      title: '📍 Today',
      desc: "See your jobs for the day, clock in and out, and view your route on the map. This is your home base.",
    },
    {
      tab: 'timesheets',
      selector: '[data-tab="timesheets"]',
      title: '⏱️ My Timesheet',
      desc: 'View and track your hours worked. Your timesheet is automatically updated when you clock in and out.',
    },
  ],
};

export default function OnboardingWalkthrough({ role, onComplete }) {
  const steps = STEPS[role] || STEPS.crew;
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const rafRef = useRef(null);

  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;

  // Position the spotlight and tooltip around the target element
  const updatePosition = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.selector);
    if (!el) {
      // Element not found — position tooltip in center
      setSpotlightRect(null);
      setTooltipPos({ top: window.innerHeight / 2 - 100, left: window.innerWidth / 2 - 175 });
      return;
    }

    const rect = el.getBoundingClientRect();
    const pad = 6;
    setSpotlightRect({
      top:    rect.top - pad,
      left:   rect.left - pad,
      width:  rect.width + pad * 2,
      height: rect.height + pad * 2,
    });

    // Position tooltip below the element, centered horizontally
    const tooltipW = 350;
    let left = rect.left + rect.width / 2 - tooltipW / 2;
    let top = rect.bottom + 16;

    // Keep tooltip on screen
    if (left < 16) left = 16;
    if (left + tooltipW > window.innerWidth - 16) left = window.innerWidth - tooltipW - 16;
    // If tooltip would go below viewport, show above
    if (top + 200 > window.innerHeight) {
      top = rect.top - 200 - 16;
      if (top < 16) top = 16;
    }

    setTooltipPos({ top, left });
  }, [step]);

  // Switch tab and update position when step changes
  useEffect(() => {
    if (!step) return;

    // Switch to the correct tab
    const tabBtn = document.querySelector(step.selector);
    if (tabBtn && window.switchTab) {
      window.switchTab(step.tab, tabBtn);
    }

    // Wait a frame for the tab switch to render, then position
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(updatePosition);
    });

    // Also update on resize
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('resize', updatePosition);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [step, updatePosition]);

  function handleNext() {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(s => s + 1);
    }
  }

  function handleBack() {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  }

  // Final "all done" screen
  if (currentStep >= steps.length) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 99998,
      fontFamily: "'Nunito', sans-serif",
    }}>
      {/* Dark overlay with cutout */}
      {spotlightRect ? (
        <div style={{
          position: 'fixed',
          top:    spotlightRect.top,
          left:   spotlightRect.left,
          width:  spotlightRect.width,
          height: spotlightRect.height,
          borderRadius: 12,
          boxShadow: '0 0 0 9999px rgba(10,30,40,0.82)',
          zIndex: 99998,
          pointerEvents: 'none',
          transition: 'all 0.35s ease',
        }} />
      ) : (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(10,30,40,0.82)',
          zIndex: 99998,
          pointerEvents: 'none',
        }} />
      )}

      {/* Clickable overlay to prevent interactions outside spotlight */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        cursor: 'default',
      }} onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div style={{
        position: 'fixed',
        top:  tooltipPos.top,
        left: tooltipPos.left,
        width: 350,
        zIndex: 99999,
        transition: 'top 0.35s ease, left 0.35s ease',
      }}>
        <div style={{
          background: '#fff', borderRadius: 16, padding: '22px 24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        }}>
          {/* Step counter */}
          <div style={{
            fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--teal, #2a9db5)', marginBottom: 8,
          }}>
            Step {currentStep + 1} of {steps.length}
          </div>

          {/* Title */}
          <h3 style={{
            fontFamily: "'Montserrat', sans-serif", fontSize: 18, fontWeight: 900,
            color: '#1a3a4a', margin: '0 0 8px',
          }}>
            {step.title}
          </h3>

          {/* Description */}
          <p style={{
            fontSize: 13, color: '#4a7a8a', fontWeight: 600,
            lineHeight: 1.6, margin: '0 0 20px',
          }}>
            {step.desc}
          </p>

          {/* Navigation buttons */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                style={{
                  padding: '8px 16px', borderRadius: 10,
                  border: '2px solid var(--teal, #2a9db5)', background: 'transparent',
                  color: 'var(--teal, #2a9db5)', fontSize: 13, fontWeight: 800, cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleNext}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, var(--teal, #2a9db5), var(--teal-dark, #1a6ea8))',
                color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer',
              }}
            >
              {isLast ? "I'm Ready! 🎉" : 'Next →'}
            </button>
          </div>

          {/* Skip link */}
          <button
            onClick={onComplete}
            style={{
              width: '100%', padding: 8, marginTop: 8, border: 'none',
              background: 'transparent', color: '#9ab4bc', fontSize: 12,
              fontWeight: 700, cursor: 'pointer',
            }}
          >
            Skip Tutorial
          </button>
        </div>
      </div>
    </div>
  );
}
