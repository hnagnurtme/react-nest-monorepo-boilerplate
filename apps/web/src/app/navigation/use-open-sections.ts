import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'sidebar_open_sections';

function readStored(): string[] | null {
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : null;
  } catch {
    // Blocked storage or a value another version wrote: start from the default.
    return null;
  }
}

function writeStored(ids: readonly string[]): void {
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Remembering which sections were open is not worth failing a render over.
  }
}

export interface OpenSections {
  isOpen: (sectionId: string) => boolean;
  toggle: (sectionId: string) => void;
}

/**
 * Which sidebar sections are expanded.
 *
 * `localStorage`, not `sessionStorage`: unlike the active tenant this is a
 * lasting preference, and it is the same in every tab.
 *
 * The section holding the current page is always open, whatever was stored —
 * a collapsed group hiding the page you are looking at reads as a bug.
 */
export function useOpenSections(activeSectionId: string | null): OpenSections {
  const [openIds, setOpenIds] = useState<string[]>(() => readStored() ?? []);

  useEffect(() => {
    if (activeSectionId === null) return;
    setOpenIds((current) =>
      current.includes(activeSectionId) ? current : [...current, activeSectionId],
    );
  }, [activeSectionId]);

  const toggle = useCallback((sectionId: string) => {
    setOpenIds((current) => {
      const next = current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId];
      writeStored(next);
      return next;
    });
  }, []);

  const isOpen = useCallback((sectionId: string) => openIds.includes(sectionId), [openIds]);

  return { isOpen, toggle };
}
