import { useCallback, useMemo, useState } from 'react';

export interface Disclosure {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

/** Open/closed state for dialogs, drawers and inline forms. */
export function useDisclosure(initial = false): Disclosure {
  const [isOpen, setIsOpen] = useState(initial);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);
  const close = useCallback(() => {
    setIsOpen(false);
  }, []);
  const toggle = useCallback(() => {
    setIsOpen((previous) => !previous);
  }, []);

  return useMemo(() => ({ isOpen, open, close, toggle }), [isOpen, open, close, toggle]);
}
