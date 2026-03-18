import { Component } from 'react';

// ── ErrorBoundary ──────────────────────────────────────────────────────────────
// Class component — function components cannot be error boundaries in React.
// Catches render-time errors in its subtree and shows a friendly fallback UI.
//
// Props:
//   name     — string: tab/panel name shown in the fallback (e.g. "Today")
//   children — the component tree to protect

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error(`[CrewHub] Error in ${this.props.name || 'tab'} panel:`, error, info.componentStack);
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
        gap: 16,
      }}>
        <div style={{ fontSize: 48 }}>⚠️</div>
        <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--text)' }}>
          {this.props.name ? `${this.props.name} panel` : 'This panel'} ran into a problem
        </div>
        <div style={{ fontSize: 14, color: 'var(--muted)', maxWidth: 360, lineHeight: 1.5 }}>
          {this.state.error?.message || 'An unexpected error occurred.'}
        </div>
        <button
          onClick={() => this.handleReset()}
          style={{
            marginTop: 8, background: 'var(--teal)', color: 'white',
            border: 'none', borderRadius: 20, padding: '10px 24px',
            fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    );
  }
}
