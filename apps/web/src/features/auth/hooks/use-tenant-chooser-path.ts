import { useAuthStore, type PublicUser } from '@/entities/session';

/**
 * Where the restaurant chooser lives, which is not the same page for everybody.
 *
 * A platform account chooses on its own home page — the chooser is that page's
 * content, inside the app shell — so it goes there with `?change=1`. A tenant
 * account gets the standalone `/select-tenant` screen: for it the whole app is
 * behind the choice, so there is no home page to show the chooser instead of.
 *
 * `change=1` in both: it is what keeps the page the chooser when a tenant is
 * already remembered, which is the normal case rather than an error. It lives
 * in the query string so that reloading the page one is looking at does not
 * change what it does.
 */
export function chooserPathFor(scope: PublicUser['scope'] | undefined): string {
  return scope === 'platform' ? '/?change=1' : '/select-tenant?change=1';
}

/** {@link chooserPathFor} for the signed-in account. */
export function useTenantChooserPath(): string {
  const scope = useAuthStore((state) => state.user?.scope);

  return chooserPathFor(scope);
}
