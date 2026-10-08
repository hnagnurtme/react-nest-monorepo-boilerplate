import { Spinner } from './spinner';

export interface PageLoaderProps {
  /** Announced to assistive tech while the route or data loads. */
  label?: string;
}

/** Full-page busy indicator, used by route-level Suspense boundaries. */
export function PageLoader({ label = 'Loading' }: PageLoaderProps) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size="lg" className="text-primary" label={label} />
    </div>
  );
}
