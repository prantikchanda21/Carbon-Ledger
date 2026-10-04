'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props { children: ReactNode; name: string; }
interface State { error: Error | null; }

export default class PanelErrorBoundary extends Component<Props, State> {
  state: State = { error: null };
  static getDerivedStateFromError(error: Error): State { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo): void { console.error(`[panel:${this.props.name}]`, error, info); }
  render(): ReactNode {
    if (this.state.error) return <div className="rounded-2xl border border-rose-400/20 bg-rose-400/5 p-5 text-xs text-slate-400">The {this.props.name} panel hit a rendering error. Core controller state is still running.</div>;
    return this.props.children;
  }
}
