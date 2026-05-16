import { Component, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  handleRetry = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-8 max-w-md">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-400 mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Something went wrong</h2>
            <p className="text-sm text-neutral-400 mb-1">An unexpected error occurred while rendering this page.</p>
            {this.state.error && (
              <p className="text-xs text-neutral-600 font-mono mt-2 mb-4 break-all">{this.state.error.message}</p>
            )}
            <button onClick={this.handleRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#fdb913] px-5 py-2.5 text-sm font-semibold text-black hover:bg-[#e5a710] transition-colors">
              <RotateCcw className="h-4 w-4" />Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
