import { Component, type ErrorInfo, type ReactNode } from "react";

type RuntimeBoundaryProps = {
  fallback: ReactNode;
  resetKey: string;
  children: ReactNode;
};

type RuntimeBoundaryState = {
  hasError: boolean;
};

export class RuntimeBoundary extends Component<RuntimeBoundaryProps, RuntimeBoundaryState> {
  public state: RuntimeBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): RuntimeBoundaryState {
    return { hasError: true };
  }

  public componentDidUpdate(previousProps: RuntimeBoundaryProps): void {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[Codex Avatar] Runtime renderer failed", error, info.componentStack);
  }

  public render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
