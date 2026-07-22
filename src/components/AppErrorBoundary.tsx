import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

// Top-level recovery boundary (2026-07-22). A Convex useQuery that errors
// (e.g. a server-side timeout during backend degradation) throws at render
// time; layout-level hooks (DashboardLayout, HeroStatsBar, AmbientProvider
// consumers) sit above every SectionErrorBoundary, so without this the whole
// tree unmounted into a permanently black page. This boundary catches those
// escapes and AUTO-RETRIES with backoff — transient backend stutter degrades
// to a brief "reconnecting" panel instead of a dead app.
export default class AppErrorBoundary extends Component<Props, State> {
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("AppErrorBoundary caught:", error, info);
    // Backoff: 5s, 10s, 20s, then every 30s. Convex subscriptions re-fire on
    // remount, so a recovered backend brings the app back without user action.
    const delayMs = Math.min(5000 * 2 ** this.state.retryCount, 30000);
    this.retryTimer = setTimeout(() => {
      this.setState((s) => ({
        hasError: false,
        error: null,
        retryCount: s.retryCount + 1,
      }));
    }, delayMs);
  }

  componentWillUnmount() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }

  handleManualRetry = () => {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.setState((s) => ({
      hasError: false,
      error: null,
      retryCount: s.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
          <div className="max-w-md w-full border border-red-500/30 rounded-xl p-6 bg-gray-900/60">
            <p className="text-lg font-semibold text-gray-100">
              CodePulse hit a backend error
            </p>
            <p className="text-sm text-gray-400 mt-2 break-words">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <p className="text-sm text-gray-500 mt-3">
              Retrying automatically&hellip; the dashboard will come back as
              soon as the backend responds.
            </p>
            <button
              onClick={this.handleManualRetry}
              className="mt-4 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-sm text-gray-200 rounded-lg transition-colors"
            >
              Retry now
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
