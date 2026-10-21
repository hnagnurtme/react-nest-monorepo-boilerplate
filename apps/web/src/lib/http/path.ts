/**
 * Fills the `{param}` slots of a contract path.
 *
 * The template is a `paths` key, so it is the same string the generated types
 * are indexed by: one spelling for the request and its response shape. Every
 * value is percent-encoded here rather than at each call site, which is the
 * step the hand-written concatenations kept forgetting.
 */
export function apiPath(template: string, params: Record<string, string> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = params[key];
    if (value === undefined) {
      throw new Error(`Missing path param "${key}" for ${template}`);
    }
    return encodeURIComponent(value);
  });
}
