import { Component, type ReactNode } from "react";
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  override state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  override render() {
    if (this.state.error)
      return (
        <main className="fatal-error">
          <h1>Let’s get you back.</h1>
          <p>Aether could not open this view: {this.state.error}</p>
          <button onClick={() => location.reload()}>Reload Aether</button>
          <p>Your saved data has not been deleted.</p>
        </main>
      );
    return this.props.children;
  }
}
