import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // eslint-disable-next-line no-console
    console.error("ErrorBoundary caught", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel">
          <div className="small">
            A panel crashed while rendering. Please switch tabs or reload. Selection has been cleared.
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}


