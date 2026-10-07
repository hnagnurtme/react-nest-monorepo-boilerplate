import { z } from 'zod';

import type { PackedRules } from '@repo/shared-types';

/**
 * Shape of CASL's packed rules: a list of tuples whose members are strings,
 * numbers, booleans, null or a plain object (the condition). The contract types
 * them as `unknown[]`, so the response is checked here before it reaches
 * `abilityFromPacked`; a malformed payload degrades to "no permissions"
 * instead of throwing inside a render.
 */
const MAX_RULES = 500;

const packedMember = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.record(z.string(), z.unknown()),
]);

export const packedRulesSchema = z.array(z.array(packedMember).min(1).max(8)).max(MAX_RULES);

export function parsePackedRules(value: unknown): PackedRules | undefined {
  const result = packedRulesSchema.safeParse(value);
  // The schema validates the structure; the tuple typing is CASL's own.
  return result.success ? (result.data as unknown as PackedRules) : undefined;
}
