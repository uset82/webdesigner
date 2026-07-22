import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AvatarRuntimeBoundary extends Component<Props, State> {
  public state: State = { failed: false };

  public static getDerivedStateFromError(): State {
    return { failed: true };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn("[Codex Avatar] SVG runtime failed; showing fallback", error, info.componentStack);
  }

  public render(): ReactNode {
    if (this.state.failed) {
      return (
        <div className="avatar-shell avatar-runtime-fallback" role="status">
          Avatar fallback active
        </div>
      );
    }
    return this.props.children;
  }
}
