/**
 * P011 Context Capsule — T005 capsule state.
 *
 * Spec invariants (IMPLEMENTATION_PLAN §7, PROJECT_BOOK §4.3, §8, FR04/FR05/FR10/FR11):
 * - buildCapsule only accepts confirmed items. Candidate and rejected
 *   items never enter the exported capsule (CC-08).
 * - Editing keeps the original source as a review clue; it does not
 *   claim the source supports the edited text (PROJECT_BOOK §8).
 * - Manual items are marked origin 'manual' and carry no source.
 * - Deleting an item removes it from the capsule; a later build must
 *   not resurrect it (FR10, CC-11).
 * - Clearing restores the workspace to empty sections (FR11, CC-12).
 * - Export order is deterministic: fixed SECTION_KEYS order, input
 *   order within each section. Repeated builds do not shuffle items.
 * - All helpers are pure: inputs are never mutated; new objects are
 *   returned. Source strings are never modified here.
 */

import type { Capsule, CapsuleItem, CapsuleSections, SectionKey } from './types'
import { emptySections, newCapsule, SECTION_KEYS } from './types'
import type { SectionedCandidate } from './conflicts'

function cloneSections(sections: CapsuleSections): CapsuleSections {
  const out = emptySections()
  for (const key of SECTION_KEYS) {
    out[key] = sections[key].map((item) => ({ ...item }))
  }
  return out
}

function mapItem(
  sections: CapsuleSections,
  section: SectionKey,
  id: string,
  fn: (item: CapsuleItem) => CapsuleItem,
): CapsuleSections {
  const out = cloneSections(sections)
  out[section] = out[section].map((item) => (item.id === id ? fn(item) : item))
  return out
}

/** Confirm one item (candidate -> confirmed). Other states unchanged. */
export function confirmItem(
  sections: CapsuleSections,
  section: SectionKey,
  id: string,
): CapsuleSections {
  return mapItem(sections, section, id, (item) => ({ ...item, status: 'confirmed' }))
}

/** Reject one item (candidate/confirmed -> rejected). */
export function rejectItem(
  sections: CapsuleSections,
  section: SectionKey,
  id: string,
): CapsuleSections {
  return mapItem(sections, section, id, (item) => ({ ...item, status: 'rejected' }))
}

/** Edit an item's text, keeping origin and source as review clues. */
export function editItem(
  sections: CapsuleSections,
  section: SectionKey,
  id: string,
  text: string,
): CapsuleSections {
  return mapItem(sections, section, id, (item) => ({ ...item, text }))
}

/** Delete one item from its section. It will not reappear in a build. */
export function deleteItem(
  sections: CapsuleSections,
  section: SectionKey,
  id: string,
): CapsuleSections {
  const out = cloneSections(sections)
  out[section] = out[section].filter((item) => item.id !== id)
  return out
}

/** Add a manual item: origin 'manual', no source, starts as candidate. */
export function addManualItem(
  sections: CapsuleSections,
  section: SectionKey,
  item: Omit<CapsuleItem, 'origin' | 'status' | 'source'>,
): CapsuleSections {
  const out = cloneSections(sections)
  out[section] = [
    ...out[section],
    { ...item, origin: 'manual', status: 'candidate' },
  ]
  return out
}

/** Clear the whole workspace to empty sections (CC-12). */
export function clearCapsule(sections: CapsuleSections): CapsuleSections {
  void sections
  return emptySections()
}

/**
 * Build a capsule from sectioned candidates.
 * Only status === 'confirmed' items are included, grouped by section
 * in fixed SECTION_KEYS order, preserving input order within a section.
 * Candidate/rejected items are dropped, never auto-confirmed.
 */
export function buildCapsule(
  candidates: readonly SectionedCandidate[],
  title: string,
  now = new Date(),
): Capsule {
  const capsule = newCapsule(title, now)
  for (const key of SECTION_KEYS) {
    capsule.sections[key] = candidates
      .filter((c) => c.section === key && c.item.status === 'confirmed')
      .map((c) => ({ ...c.item }))
  }
  return capsule
}

/** Convenience: build from already-grouped sections (same confirmed-only rule). */
export function buildCapsuleFromSections(
  sections: CapsuleSections,
  title: string,
  now = new Date(),
): Capsule {
  const capsule = newCapsule(title, now)
  for (const key of SECTION_KEYS) {
    capsule.sections[key] = sections[key]
      .filter((item) => item.status === 'confirmed')
      .map((item) => ({ ...item }))
  }
  return capsule
}
