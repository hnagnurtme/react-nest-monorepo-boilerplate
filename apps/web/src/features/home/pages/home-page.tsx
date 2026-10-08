import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import { useBrand } from '@/shared/hooks';
import { Alert, PageShell } from '@/shared/ui';

/**
 * The brand page. It carries no navigation any more — the sidebar does that —
 * so what is left is the identity of the deployment and, when a guard turned
 * someone away, the reason why.
 */
export function HomePage() {
  const { t } = useTranslation('auth');
  const brand = useBrand();
  const location = useLocation();
  const accessDenied = (location.state as { accessDenied?: boolean } | null)?.accessDenied === true;

  return (
    <PageShell width="full" isCentered className="text-center">
      {accessDenied ? (
        <Alert className="max-w-form mx-auto text-left">{t('home.accessDenied')}</Alert>
      ) : null}

      {brand.thumbnailUrl ? (
        <img
          src={brand.thumbnailUrl}
          alt={brand.name}
          width={320}
          height={192}
          className="rounded-surface mx-auto h-48 w-auto object-contain"
        />
      ) : null}
      <h1 className="text-foreground text-display font-bold">{brand.name}</h1>
      <p className="text-muted-foreground text-body">{brand.slogan}</p>
    </PageShell>
  );
}
