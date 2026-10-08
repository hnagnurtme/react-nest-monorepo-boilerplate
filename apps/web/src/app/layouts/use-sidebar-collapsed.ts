import { useCallback, useState } from 'react';

const STORAGE_KEY = 'sidebar_collapsed';

function readStored(): boolean {
  try {
    return globalThis.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

/** Whether the desktop sidebar is a rail. A lasting preference, so `localStorage`. */
export function useSidebarCollapsed(): { isCollapsed: boolean; toggle: () => void } {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => readStored());

  const toggle = useCallback(() => {
    setIsCollapsed((current) => {
      const next = !current;
      try {
        globalThis.localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // A forgotten preference is not worth failing a render over.
      }
      return next;
    });
  }, []);

  return { isCollapsed, toggle };
}
