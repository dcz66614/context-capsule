/**
 * P011 Context Capsule — T008 page workflow (pure helpers).
 * Spec PROJECT_BOOK §6 / §10 and IMPLEMENTATION_PLAN §7–§8:
 * - generate: extract candidates, group into the seven fixed
 *   sections, in section order. Never auto-confirms.
 * - conflicts: detectConflicts over the current sections, naming
 *   both candidates; never auto-deletes or auto-resolves.
 * - preview: buildCapsuleFromSections (confirmed only) +
 *   exportMarkdown / exportJSON.
 * - stats: FR14 capsule length (characters + item counts).
 * - sensitiveHints: LOCAL pattern scan only (email, Chinese
 *   mobile) for the §10 tier-2 risk hint. It does not promise
 *   complete detection; the UI must say so.
 * - All helpers here are pure and synchronous and make no
 *   network request; the app stores state in memory only.
 *   Offline verification in a browser (network log) belongs
 *   to T009, not to a unit-test claim here.
 */
import { extractCandidates, groupCandidatesBySection } from '../core/extract'
import { detectConflicts } from '../core/conflicts'
import type { Conflict, SectionedCandidate } from '../core/conflicts'
import { buildCapsuleFromSections } from '../core/capsule'
import { emptySections, SECTION_KEYS } from '../core/types'
import type { Capsule, CapsuleItem, CapsuleSections, SectionKey } from '../core/types'
import { exportMarkdown } from '../io/markdown'
import { exportJSON } from '../io/json'

export interface WorkspaceState {
  rawText: string
  title: string
  sections: CapsuleSections
}

export function emptyWorkspace(): WorkspaceState {
  return { rawText: '', title: '', sections: emptySections() }
}

/** Extract candidates from raw text and group them into sections. */
export function generateSections(rawText: string): CapsuleSections {
  const items = extractCandidates(rawText)
  const grouped = groupCandidatesBySection(items, rawText)
  const sections = emptySections()
  for (const key of SECTION_KEYS) {
    sections[key] = grouped[key]
  }
  return sections
}

/** Flatten sectioned state (section order, input order within a section). */
export function sectionedCandidates(sections: CapsuleSections): SectionedCandidate[] {
  const out: SectionedCandidate[] = []
  for (const key of SECTION_KEYS) {
    for (const item of sections[key]) {
      out.push({ section: key, item })
    }
  }
  return out
}

export function computeConflicts(sections: CapsuleSections): Conflict[] {
  return detectConflicts(sectionedCandidates(sections))
}

/** Slice an item's source snippet from the raw text, or null when unavailable. */
export function sourceSnippetFor(rawText: string, item: CapsuleItem): string | null {
  if (!item.source) return null
  const { start, end } = item.source
  if (start < 0 || end <= start || end > rawText.length) return null
  return rawText.slice(start, end)
}

export interface CapsuleStats {
  confirmedCount: number
  totalCount: number
  capsuleCharCount: number
  perSection: Record<SectionKey, { total: number; confirmed: number }>
}

export function capsuleStats(sections: CapsuleSections): CapsuleStats {
  const perSection = {} as CapsuleStats['perSection']
  let confirmedCount = 0
  let totalCount = 0
  let capsuleCharCount = 0
  for (const key of SECTION_KEYS) {
    const items = sections[key]
    const confirmed = items.filter((i) => i.status === 'confirmed')
    perSection[key] = { total: items.length, confirmed: confirmed.length }
    confirmedCount += confirmed.length
    totalCount += items.length
    capsuleCharCount += confirmed.reduce((sum, i) => sum + i.text.length, 0)
  }
  return { confirmedCount, totalCount, capsuleCharCount, perSection }
}

export function previewCapsule(state: WorkspaceState): Capsule {
  return buildCapsuleFromSections(state.sections, state.title || 'Context Capsule')
}

export function previewMarkdown(state: WorkspaceState): string {
  return exportMarkdown(previewCapsule(state))
}

export function previewJSON(state: WorkspaceState): string {
  return exportJSON(previewCapsule(state))
}

/** Handover prompt for copying into another AI session (preview only, not an export file). */
export function handoverPrompt(state: WorkspaceState): string {
  return `请基于以下 Context Capsule 继续任务，不要遗漏其中已确认的决策与禁止事项：\n\n${previewMarkdown(state)}`
}

export interface SensitiveHint {
  kind: 'email' | 'phone'
  snippet: string
  index: number
}

const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE_PATTERN = /1[3-9]\d{9}/g

/** Local pattern scan only; incomplete by design (spec §10 tier 2). */
export function sensitiveHints(text: string): SensitiveHint[] {
  const hints: SensitiveHint[] = []
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    hints.push({ kind: 'email', snippet: match[0], index: match.index ?? 0 })
  }
  for (const match of text.matchAll(PHONE_PATTERN)) {
    hints.push({ kind: 'phone', snippet: match[0], index: match.index ?? 0 })
  }
  return hints
}
