import { useEffect, useState } from 'react';

/** Subscribes to a CSS media query, for the few cases a Tailwind breakpoint cannot cover. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent): void => {
      setMatches(event.matches);
    };
    list.addEventListener('change', onChange);
    return () => {
      list.removeEventListener('change', onChange);
    };
  }, [query]);

  return matches;
}
