import React from "react";

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: unknown };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ErrorBoundary.tsx:10',message:'getDerivedStateFromError called',data:{error:String(error),errorName:(error as any)?.name,errorMessage:(error as any)?.message,errorStack:(error as any)?.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    } catch {}
    // #endregion
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // #region agent log
    try {
      fetch('http://127.0.0.1:7243/ingest/805d96a4-16fd-497c-a6cf-f845abf2b95f',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'ErrorBoundary.tsx:16',message:'componentDidCatch called',data:{error:String(error),errorName:(error as any)?.name,errorMessage:(error as any)?.message,errorStack:(error as any)?.stack?.substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    } catch {}
    // #endregion
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


