import { RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import i18n from '@/lib/i18n';
import { Button, ErrorState, PageShell } from '@/shared/ui';

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
        <PageShell width="form" isCentered>
          <ErrorState
            title={i18n.t('errorBoundary.title', { ns: 'auth' })}
            description={i18n.t('errorBoundary.description', { ns: 'auth' })}
            action={
              <Button type="button" size="sm" isFullWidth onClick={this.handleReset}>
                <RefreshCw className="size-4" aria-hidden="true" />
                {i18n.t('errorBoundary.retry', { ns: 'auth' })}
              </Button>
            }
          />
          {this.state.error === undefined ? null : (
            // The raw message is for the developer in the console-less case; it is
            // deliberately below the fold of the state card and never styled as copy.
            <pre className="text-caption bg-muted text-muted-foreground rounded-inner max-h-32 overflow-auto p-2 text-left">
              {this.state.error.message}
            </pre>
          )}
        </PageShell>
      );
    }

    return this.props.children;
  }
}
