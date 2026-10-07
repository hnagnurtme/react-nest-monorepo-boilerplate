import '@testing-library/jest-dom/vitest';

declare global {
  /** Raw `globals.css`, injected by `define` in vite.config.ts. */
  const GLOBALS_CSS_RAW: string;
}
