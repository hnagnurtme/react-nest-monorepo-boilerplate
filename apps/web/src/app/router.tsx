import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import { ErrorBoundary } from './components/error-boundary';
import { PageLoader } from './components/page-loader';
import { RouteGuard } from './components/route-guard';

const HomePage = lazy(() =>
  import('@/features/home').then((module) => ({ default: module.HomePage })),
);

const LoginPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.LoginPage })),
);

const RegisterPage = lazy(() =>
  import('@/features/auth').then((module) => ({ default: module.RegisterPage })),
);

const StatusPage = lazy(() =>
  import('@/features/status').then((module) => ({ default: module.StatusPage })),
);

const UsersPage = lazy(() =>
  import('@/features/users').then((module) => ({ default: module.UsersPage })),
);

export function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/status" element={<StatusPage />} />
          <Route
            path="/users"
            element={
              <RouteGuard allowedRoles={['PLATFORM_ADMIN', 'TENANT_ADMIN', 'TENANT_MEMBER']}>
                <UsersPage />
              </RouteGuard>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
