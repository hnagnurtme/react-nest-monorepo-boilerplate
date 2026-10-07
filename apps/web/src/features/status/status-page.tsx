import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { HealthStatus } from '@repo/shared-types';

import { getApiHealth } from '@/lib/http/health';

type StatusState =
  { kind: 'loading' } | { kind: 'healthy'; health: HealthStatus } | { kind: 'error' };

export function StatusPage() {
  const { t } = useTranslation('auth');
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
      <h1>{t('status.title')}</h1>
      {state.kind === 'loading' && <p role="status">{t('status.checking')}</p>}
      {state.kind === 'healthy' && (
        <p>{t('status.healthy', { service: state.health.service.toUpperCase() })}</p>
      )}
      {state.kind === 'error' && <p>{t('status.unavailable')}</p>}
    </main>
  );
}
