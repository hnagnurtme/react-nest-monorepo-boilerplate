import { useEffect, useState } from 'react';

import type { HealthStatus } from '@repo/shared-types';

import { getApiHealth } from '@/lib/http/health';

type StatusState =
  { kind: 'loading' } | { kind: 'healthy'; health: HealthStatus } | { kind: 'error' };

export function StatusPage() {
  const [state, setState] = useState<StatusState>({ kind: 'loading' });

  useEffect(() => {
    void getApiHealth().then(
      (health) => {
        setState({ kind: 'healthy', health });
      },
      () => {
        setState({ kind: 'error' });
      },
    );
  }, []);

  return (
    <main>
      <h1>Platform status</h1>
      {state.kind === 'loading' && <p role="status">Checking API status</p>}
      {state.kind === 'healthy' && <p>{state.health.service.toUpperCase()} is healthy</p>}
      {state.kind === 'error' && <p>API is unavailable</p>}
    </main>
  );
}
