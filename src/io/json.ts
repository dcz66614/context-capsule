/**
 * P011 Context Capsule — T007 JSON export / import.
 * Spec PROJECT_BOOK §8: the wire format uses `schemaVersion`
 * (not the scaffold's internal `version`) and manual items carry
 * `source: null` (not an absent field). This module is the ONLY
 * place that translation happens, explicitly, in both directions:
 *   internal Capsule { version, source?: SourceRef }
 *     <-> wire { schemaVersion, source: SourceRef | null }
 * Internal code never sees schemaVersion; wire files never see
 * the internal `version` field or an absent source.
 *
 * Import validation (fail loudly, never silently repair):
 * - JSON must parse, be an object, and match the wire schema
 *   exactly (strict: unknown fields are rejected, not stripped).
 * - schemaVersion must be exactly '1.0.0'.
 * - All seven sections must be present, each an array.
 * - Item ids must be unique across the whole capsule
 *   (FINDING-T011-04: duplicate ids make confirm/delete/edit
 *   act on two items at once).
 * - Item text 1–5000 chars, title 0–500 chars, total items ≤1000,
 *   JSON text ≤1,000,000 chars. These limits are implementation
 *   limits (the spec requires count/length validation but gives
 *   no numbers); they are documented here, not claimed as spec
 *   numbers.
 * - Source offsets must satisfy 0 ≤ start < end.
 * Export is deterministic: fixed section order, input order
 * within a section, 2-space JSON indentation.
 * Export only includes confirmed items (FINDING-T011-03):
 * exportJSON filters defensively, the same invariant as
 * exportMarkdown, even if it is handed a capsule that still
 * holds candidate/rejected items.
 */
import { z } from 'zod'
import type { Capsule, CapsuleItem, CapsuleSections, SectionKey } from '../core/types'
import { emptySections, newCapsule, SECTION_KEYS } from '../core/types'

export const MAX_JSON_CHARS = 1_000_000
export const MAX_ITEM_TEXT_CHARS = 5_000
export const MAX_TITLE_CHARS = 500
export const MAX_TOTAL_ITEMS = 1_000

const wireSourceSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  })
  .strict()
  .refine((s) => s.end > s.start, { message: 'source.end must be greater than source.start' })
  .nullable()

const wireItemSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1).max(MAX_ITEM_TEXT_CHARS),
    origin: z.enum(['extracted', 'manual']),
    status: z.enum(['candidate', 'confirmed', 'rejected']),
    source: wireSourceSchema,
  })
  .strict()

const wireSectionsSchema = z
  .object(
    Object.fromEntries(SECTION_KEYS.map((key) => [key, z.array(wireItemSchema)])) as Record<
      SectionKey,
      z.ZodArray<typeof wireItemSchema>
    >,
  )
  .strict()

const wireCapsuleSchema = z
  .object({
    schemaVersion: z.literal('1.0.0'),
    title: z.string().max(MAX_TITLE_CHARS),
    sections: wireSectionsSchema,
  })
  .strict()

type WireCapsule = z.infer<typeof wireCapsuleSchema>

function toWireItem(item: CapsuleItem): WireCapsule['sections'][SectionKey][number] {
  return {
    id: item.id,
    text: item.text,
    origin: item.origin,
    status: item.status,
    // Explicit translation: absent internal source -> wire null.
    source: item.source ?? null,
  }
}

function toWire(capsule: Capsule): WireCapsule {
  const sections = emptySections() as unknown as WireCapsule['sections']
  for (const key of SECTION_KEYS) {
    // Defensive confirmed-only filter (FINDING-T011-03, spec §8):
    // a capsule handed to exportJSON directly may still hold
    // candidate/rejected items; they must never reach the file,
    // exactly like exportMarkdown. buildCapsuleFromSections already
    // enforces this on the app path, so this changes nothing there.
    sections[key] = capsule.sections[key]
      .filter((item) => item.status === 'confirmed')
      .map(toWireItem)
  }
  return { schemaVersion: '1.0.0', title: capsule.title, sections }
}

function fromWire(wire: WireCapsule): Capsule {
  const capsule = newCapsule(wire.title)
  const sections: CapsuleSections = emptySections()
  for (const key of SECTION_KEYS) {
    sections[key] = wire.sections[key].map((item) => {
      const out: CapsuleItem = {
        id: item.id,
        text: item.text,
        origin: item.origin,
        status: item.status,
      }
      // Explicit translation: wire null -> absent internal source.
      if (item.source !== null) {
        out.source = { start: item.source.start, end: item.source.end }
      }
      return out
    })
  }
  capsule.sections = sections
  return capsule
}

/** Serialise a capsule to the spec wire format. Internal id/timestamps are not part of the wire format. */
export function exportJSON(capsule: Capsule): string {
  return JSON.stringify(toWire(capsule), null, 2) + '\n'
}

/**
 * Parse and validate spec wire JSON, returning an internal Capsule.
 * Throws on any validation failure; nothing is silently repaired.
 * A fresh internal id/timestamps are assigned on import because
 * the wire format carries title + sections only.
 */
export function importJSON(jsonText: string): Capsule {
  if (jsonText.length > MAX_JSON_CHARS) {
    throw new Error(`JSON text exceeds ${MAX_JSON_CHARS} characters`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch {
    throw new Error('Invalid JSON: could not parse')
  }
  const wire = wireCapsuleSchema.parse(parsed)
  const total = SECTION_KEYS.reduce((sum, key) => sum + wire.sections[key].length, 0)
  if (total > MAX_TOTAL_ITEMS) {
    throw new Error(`Capsule exceeds ${MAX_TOTAL_ITEMS} items`)
  }
  // Item ids must be unique across the whole capsule
  // (FINDING-T011-04): duplicate ids make confirm/reject/edit/
  // delete act on two items at once, and React keys collide.
  const seenIds = new Set<string>()
  for (const key of SECTION_KEYS) {
    for (const item of wire.sections[key]) {
      if (seenIds.has(item.id)) {
        throw new Error(`Duplicate item id "${item.id}"`)
      }
      seenIds.add(item.id)
    }
  }
  return fromWire(wire)
}
