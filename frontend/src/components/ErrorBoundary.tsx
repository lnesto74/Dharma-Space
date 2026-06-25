import { Component, ErrorInfo, ReactNode } from "react";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
  };

  handleClearSession = () => {
    localStorage.removeItem("hsos_token");
    localStorage.removeItem("hsos_user");
    window.location.href = "/";
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f5f0",
          color: "#2A2825"
        }}
      >
        <div style={{ maxWidth: 560, width: "100%" }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, opacity: 0.75, marginBottom: 16 }}>
            The page hit an unexpected error. The details below can help us fix it.
          </p>
          <pre
            style={{
              background: "#fff",
              border: "1px solid #e5e0d6",
              borderRadius: 12,
              padding: 16,
              fontSize: 12,
              whiteSpace: "pre-wrap",
              overflowX: "auto",
              marginBottom: 16
            }}
          >
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ""}
          </pre>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={this.handleReset}
              style={{
                padding: "10px 16px",
                borderRadius: 9999,
                border: "1px solid #2A2825",
                background: "transparent",
                cursor: "pointer",
                fontSize: 13
              }}
            >
              Try again
            </button>
            <button
              type="button"
              onClick={this.handleClearSession}
              style={{
                padding: "10px 16px",
                borderRadius: 9999,
                border: "none",
                background: "#2A2825",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13
              }}
            >
              Sign out & reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
