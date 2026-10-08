import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { PageLoader } from '@/shared/ui';

import { ErrorBoundary } from './components/error-boundary';
import { appRoutes } from './routes/app-routes';
import { publicRoutes } from './routes/public-routes';

export function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {publicRoutes()}
          {appRoutes()}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
