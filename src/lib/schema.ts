import { z } from 'zod'
import { SECTION_KEYS } from './types'

/**
 * P011 Context Capsule — T002 Zod schemas.
 * JSON import must validate version and structure (establishment invariant);
 * anything that fails here is rejected, never silently repaired.
 */

export const sourceRefSchema = z.object({
  start: z.number().int().nonnegative(),
  end: z.number().int().positive(),
}).refine((s) => s.end > s.start, { message: 'source.end must be greater than source.start' })

export const capsuleItemSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  origin: z.enum(['extracted', 'manual']),
  status: z.enum(['candidate', 'confirmed', 'rejected']),
  source: sourceRefSchema.optional(),
})

const sectionsSchema = z.object(
  Object.fromEntries(SECTION_KEYS.map((key) => [key, z.array(capsuleItemSchema)])) as Record<
    (typeof SECTION_KEYS)[number],
    z.ZodArray<typeof capsuleItemSchema>
  >,
)

export const capsuleSchema = z.object({
  version: z.literal('1.0.0'),
  id: z.string().min(1),
  title: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sections: sectionsSchema,
})

export type CapsuleInput = z.infer<typeof capsuleSchema>

/** Parse and validate an unknown JSON value as a Capsule; throws on failure. */
export function parseCapsule(value: unknown) {
  return capsuleSchema.parse(value)
}
