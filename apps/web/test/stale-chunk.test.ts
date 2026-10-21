import { describe, expect, it, vi } from 'vitest';

import {
  installStaleChunkReload,
  isStaleChunkError,
  RELOAD_GUARD_MS,
  reloadForStaleChunk,
  type ReloadDeps,
} from '@/lib/stale-chunk';

function memoryStorage(): NonNullable<ReloadDeps['storage']> {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

describe('stale chunk recovery', () => {
  it('recognises failed dynamic imports in every browser wording', () => {
    expect(
      isStaleChunkError(
        new TypeError('Failed to fetch dynamically imported module: https://x/assets/a.js'),
      ),
    ).toBe(true);
    expect(isStaleChunkError(new TypeError('error loading dynamically imported module'))).toBe(
      true,
    );
    expect(isStaleChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isStaleChunkError('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('reloads once, then lets a repeat failure inside the guard window through', () => {
    // A chunk that is genuinely broken must not put the tab in a reload loop.
    const reload = vi.fn();
    let now = 1_000_000;
    const deps: ReloadDeps = { storage: memoryStorage(), reload, now: () => now };

    expect(reloadForStaleChunk(deps)).toBe(true);
    now += RELOAD_GUARD_MS - 1;
    expect(reloadForStaleChunk(deps)).toBe(false);
    now += 1;
    expect(reloadForStaleChunk(deps)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads without a storage guard', () => {
    const reload = vi.fn();

    expect(reloadForStaleChunk({ storage: undefined, reload, now: () => 1 })).toBe(false);
    expect(
      reloadForStaleChunk({
        storage: {
          getItem: () => {
            throw new Error('blocked');
          },
          setItem: () => undefined,
        },
        reload,
        now: () => 1,
      }),
    ).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('listens for vite:preloadError', () => {
    const target = new EventTarget();
    const reload = vi.fn();
    const deps: ReloadDeps = { storage: memoryStorage(), reload, now: () => 1_000_000 };
    installStaleChunkReload(target, () => deps);
    const event = new Event('vite:preloadError', { cancelable: true });

    target.dispatchEvent(event);

    expect(reload).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });
});
