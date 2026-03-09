import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  name?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `SectionErrorBoundary [${this.props.name ?? "unknown"}] caught:`,
      error,
      info,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-gray-800/50 border border-red-500/30 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
              <span className="text-red-400 text-sm">!</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300">
                {this.props.name ? `${this.props.name} failed to load` : "Something went wrong"}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {this.state.error?.message || "An unexpected error occurred."}
              </p>
            </div>
            <button
              onClick={this.handleRetry}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-xs text-gray-200 rounded-lg transition-colors shrink-0"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
