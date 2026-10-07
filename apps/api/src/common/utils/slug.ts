const NON_ALPHANUMERIC = /[^a-z0-9]+/gu;
const EDGE_HYPHENS = /^-+|-+$/gu;
const COMBINING_MARKS = /\p{Diacritic}/gu;

/**
 * URL-safe slug. `đ` is handled explicitly because NFD decomposition does not
 * split it into `d` + a combining mark, so Vietnamese words like "đồng" would
 * otherwise lose their first letter entirely.
 */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replaceAll('đ', 'd')
    .replaceAll('Đ', 'D')
    .toLowerCase()
    .replace(NON_ALPHANUMERIC, '-')
    .replace(EDGE_HYPHENS, '');
}
