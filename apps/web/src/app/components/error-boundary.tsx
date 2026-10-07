import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import i18n from '@/lib/i18n';
import { Button } from '@/shared/ui';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error | undefined;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error('Uncaught error in React Component:', error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: undefined });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="bg-background flex min-h-screen flex-col items-center justify-center p-6 text-center">
          <div className="border-border bg-card max-w-md space-y-4 rounded-2xl border p-8 shadow-sm">
            <div className="bg-destructive/10 text-destructive mx-auto flex h-12 w-12 items-center justify-center rounded-full">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="text-foreground text-xl font-bold">
              {i18n.t('errorBoundary.title', { ns: 'auth' })}
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm">
              {i18n.t('errorBoundary.description', { ns: 'auth' })}
            </p>
            {this.state.error && (
              <pre className="text-2xs bg-muted text-muted-foreground max-h-32 overflow-auto rounded-lg p-2 text-left">
                {this.state.error.message}
              </pre>
            )}
            <Button type="button" onClick={this.handleReset} size="xs" className="w-full">
              <RefreshCw className="h-4 w-4" />
              {i18n.t('errorBoundary.retry', { ns: 'auth' })}
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
