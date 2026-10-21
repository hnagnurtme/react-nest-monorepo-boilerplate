/**
 * Recovery from stale code-split chunks after a frontend deploy.
 *
 * Chunk names carry a content hash. A tab opened before a deploy still asks
 * for the old names; mid-rollout, a new index.html can briefly reference chunks
 * a host does not serve yet. Either way an SPA host answers the missing path
 * with index.html (its fallback), and the lazy import fails with a MIME-type
 * error. One full reload fetches the current index.html and fixes it.
 *
 * Guarded so a chunk that is genuinely broken reloads once, not in a loop: a
 * second failure inside the guard window falls through to the error boundary.
 */

const RELOAD_AT_KEY = 'stale-chunk-reload-at';
export const RELOAD_GUARD_MS = 10_000;

// Chrome / Firefox / Safari wording for a failed dynamic import.
const STALE_CHUNK_PATTERN =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

export interface ReloadDeps {
  storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  reload: () => void;
  now: () => number;
}

function defaultStorage(): ReloadDeps['storage'] {
  try {
    return window.sessionStorage;
  } catch {
    // Blocked storage (privacy mode, sandboxed iframe): no guard available.
    return undefined;
  }
}

const defaultDeps = (): ReloadDeps => ({
  storage: defaultStorage(),
  reload: () => {
    window.location.reload();
  },
  now: () => Date.now(),
});

export function isStaleChunkError(error: unknown): boolean {
  return error instanceof Error && STALE_CHUNK_PATTERN.test(error.message);
}

/**
 * Reloads the page unless it already did so within the guard window.
 * Returns whether a reload was triggered.
 */
export function reloadForStaleChunk(deps: ReloadDeps = defaultDeps()): boolean {
  // Without a working guard a reload loop is possible, so never reload blind.
  if (deps.storage === undefined) return false;
  const now = deps.now();

  try {
    const last = Number(deps.storage.getItem(RELOAD_AT_KEY) ?? 0);
    if (now - last < RELOAD_GUARD_MS) return false;
    deps.storage.setItem(RELOAD_AT_KEY, String(now));
  } catch {
    return false;
  }

  deps.reload();
  return true;
}

/**
 * Vite dispatches `vite:preloadError` when a dynamic import or its preloads
 * fail. Cancelling the event stops Vite from rethrowing once we reload.
 */
export function installStaleChunkReload(
  target: EventTarget = window,
  getDeps: () => ReloadDeps = defaultDeps,
): void {
  target.addEventListener('vite:preloadError', (event) => {
    if (reloadForStaleChunk(getDeps())) event.preventDefault();
  });
}
