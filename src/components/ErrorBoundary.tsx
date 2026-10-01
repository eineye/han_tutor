import { Component, type ReactNode } from 'react';

/** Shows a readable error with a recovery button instead of a blank screen. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(error);
  }

  reset = () => {
    try {
      for (const k of Object.keys(localStorage)) if (k.startsWith('hantutor.')) localStorage.removeItem(k);
    } catch {
      /* storage unavailable */
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <h2>문제가 생겼어요 · Something went wrong</h2>
        <p>Reload the page. If it keeps happening, reset the saved data in this browser.</p>
        <pre>{String(this.state.error?.message || this.state.error)}</pre>
        <p className="muted small">{navigator.userAgent}</p>
        <div className="row">
          <button className="btn" onClick={() => location.reload()}>
            Reload
          </button>
          <button className="btn btn--ghost" onClick={this.reset}>
            Reset data &amp; reload
          </button>
        </div>
      </div>
    );
  }
}
