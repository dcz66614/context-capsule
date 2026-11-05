/**
 * P011 Context Capsule — T002 types.
 * Source: establishment summary only (seven fixed sections, item fields,
 * local-first, no external API). No FR numbers or section content are
 * invented here; the full verbatim PROJECT_BOOK / IMPLEMENTATION_PLAN
 * texts are pending re-retrieval and must be checked against this file
 * before any later task claims spec compliance.
 */

/** Fixed seven sections, in deterministic export order. */
export const SECTION_KEYS = [
  'goal',
  'facts',
  'decisions',
  'openQuestions',
  'prohibitions',
  'progress',
  'nextSteps',
] as const

export type SectionKey = (typeof SECTION_KEYS)[number]

export type ItemOrigin = 'extracted' | 'manual'
export type ItemStatus = 'candidate' | 'confirmed' | 'rejected'

/**
 * Source offsets are UTF-16 code units: JavaScript string indices are
 * UTF-16 code units by definition, so `source.start` / `source.end` are
 * plain string indices into the original pasted text. `extract` must
 * never modify the source string.
 */
export interface SourceRef {
  start: number
  end: number
}

export interface CapsuleItem {
  id: string
  text: string
  origin: ItemOrigin
  status: ItemStatus
  source?: SourceRef
}

export type CapsuleSections = Record<SectionKey, CapsuleItem[]>

export interface Capsule {
  /** Spec version at establishment. */
  version: '1.0.0'
  id: string
  title: string
  createdAt: string
  updatedAt: string
  sections: CapsuleSections
}

export function emptySections(): CapsuleSections {
  return {
    goal: [],
    facts: [],
    decisions: [],
    openQuestions: [],
    prohibitions: [],
    progress: [],
    nextSteps: [],
  }
}

export function newCapsule(title: string, now = new Date()): Capsule {
  const stamp = now.toISOString()
  return {
    version: '1.0.0',
    id: `capsule-${now.getTime()}`,
    title,
    createdAt: stamp,
    updatedAt: stamp,
    sections: emptySections(),
  }
}
