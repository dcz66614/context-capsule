/**
 * P011 Context Capsule — T004 explicit conflict detection.
 *
 * Spec invariants (IMPLEMENTATION_PLAN §7, PROJECT_BOOK §4.3, §6):
 * - detectConflicts never auto-deletes, never auto-resolves, and never
 *   treats "the last sentence" as true. It only reports conflicts.
 * - A conflict report must name BOTH conflicting candidates, never a
 *   generic red warning alone (PROJECT_BOOK §6, FR06).
 * - Input is never modified; the returned list is new objects.
 *
 * This is a rule-based, explainable detector for EXPLICIT conflicts
 * only. It does not claim to understand implicit semantics, irony,
 * cross-turn pronouns, or complex negation (PROJECT_BOOK §4.2: MVP
 * does not promise those). Anything it cannot match explicitly is
 * left unreported for human review, not silently resolved.
 */

import type { CapsuleItem, SectionKey } from './types'

/** A candidate together with the section it was assigned to. */
export interface SectionedCandidate {
  section: SectionKey
  item: CapsuleItem
}

export interface Conflict {
  /** Stable id derived from the two item ids, in input order. */
  id: string
  /** Human-readable reason that quotes both conflicting texts. */
  reason: string
  a: SectionedCandidate
  b: SectionedCandidate
  /**
   * Set only for a decision-change warning whose changed decision
   * could not be matched to any earlier decision by content
   * (FINDING-T011-02): no earlier decision is named as the
   * superseded one. In that case `a` and `b` are both the changed
   * decision itself, and `reason` says so explicitly — the warning
   * must never be read as "the changed decision replaces X".
   */
  unpairedChange?: boolean
}

const NEGATION_TOKENS = [
  '不要',
  '禁止',
  '不得',
  '不能',
  '不允许',
  '切勿',
  '不再',
  '不使用',
  '不接',
  '不上传',
  'never',
  'do not',
  "don't",
  'must not',
  'forbidden',
]

const PROGRESS_DONE = ['已完成', '已经完成', '已实现', '已做好', 'done', 'completed']
const PROGRESS_NOT_DONE = [
  '尚未开始',
  '尚未完成',
  '未完成',
  '还没做',
  '没做',
  'not started',
  'not done',
]

function stripPunctuation(text: string): string {
  return text.replace(/[。！？.!?，、；：:；\s"“”‘’'()（）]/g, '')
}

function hasNegation(text: string): boolean {
  const compact = stripPunctuation(text)
  return NEGATION_TOKENS.some((token) => compact.includes(token.replace(/\s/g, '')))
}

function hasProgressDone(text: string): boolean {
  return PROGRESS_DONE.some((token) => text.includes(token))
}

function hasProgressNotDone(text: string): boolean {
  return PROGRESS_NOT_DONE.some((token) => text.includes(token))
}

/**
 * Normalised core: punctuation removed, negation tokens removed, and
 * common decision/progress verbs removed, so "决定使用 React" and
 * "不要使用 React" reduce to the same core ("React"), while unrelated
 * texts do not. This is deliberately conservative: cores must match
 * exactly after normalisation, otherwise no conflict is reported.
 */
function coreOf(text: string): string {
  let core = stripPunctuation(text)
  for (const token of NEGATION_TOKENS) {
    core = core.split(token.replace(/\s/g, '')).join('')
  }
  for (const verb of [
    '已经决定',
    '已决定',
    '决定',
    '最终采用',
    '确定使用',
    '采用',
    '选择',
    '选定',
    '使用',
    '已完成',
    '已经完成',
    '尚未开始',
    '尚未完成',
    '未完成',
    '测试通过',
  ]) {
    core = core.split(verb).join('')
  }
  return core
}

function conflictReason(
  kind: string,
  a: SectionedCandidate,
  b: SectionedCandidate,
): string {
  return (
    `${kind}：候选「${a.item.text}」（${a.section}）与候选「${b.item.text}」（${b.section}）相互矛盾，` +
    `请人工检查后确认其中一项，不要自动以最后一句为准。`
  )
}

/**
 * OBS-T010-05 / FINDING-T011-02: a decision that explicitly says
 * it switched is not a "contradiction" — the later decision may
 * supersede the earlier one, so the reason text is different.
 * Pairing is TOPIC-AWARE, not recency-only: the changed decision
 * is matched against earlier decisions by shared content tokens
 * (see topicTokens / topicScore). The recency-only heuristic was
 * wrong in the review probe ([MySQL, 14-inch screen, switch to
 * SQLite] paired SQLite with the screen). When no earlier decision
 * shares enough content with the changed one, the warning is
 * emitted UNPAIRED (unpairedChange: true, no earlier decision
 * named) instead of guessing — a wrong named pairing could make
 * a careless reviewer reject the wrong old decision. The report
 * is a review warning only — never auto-resolving, never
 * deleting — and it fires only on an explicit change marker,
 * never on an ordinary decision.
 */
const CHANGE_MARKERS = ['改用', '改回', '改主意', '改成', '换成', '换回']

/**
 * Single CJK characters that carry no topic on their own
 * (pronouns, function words, temporal/demonstrative words).
 * Latin/digit runs (e.g. MySQL, SQLite, React) are never stops:
 * one shared run is strong evidence of the same topic.
 */
const TOPIC_STOP_CHARS = new Set([
  ...'的了在是有和与或把被给就都也还再更最很要会能可以及等对从向为之其此该个些种类项条次点面上中内外左右大小新旧好坏一不没这那他她它们地得着过来去出入到说想看做用我你您咱自改换回成',
])

/** Minimum shared-token score for a named pairing (see topicScore). */
const MIN_TOPIC_SCORE = 2

/**
 * Content tokens of a decision text, for change pairing:
 * coreOf() first (decision/progress verbs and negation stripped),
 * then change markers and the "改主意" idiom removed, then split
 * into Latin/digit runs (weight 3) and single CJK characters
 * (weight 1, stop characters dropped).
 */
function topicTokens(text: string): Map<string, number> {
  let core = coreOf(text)
  for (const marker of [...CHANGE_MARKERS, '改主意']) {
    core = core.split(marker).join('')
  }
  const tokens = new Map<string, number>()
  for (const match of core.matchAll(/[A-Za-z0-9]+|[\u4e00-\u9fff]/g)) {
    const token = match[0]
    if (token.length === 1 && TOPIC_STOP_CHARS.has(token)) continue
    tokens.set(token, token.length === 1 ? 1 : 3)
  }
  return tokens
}

/** Sum of weights of tokens shared by both token maps. */
function topicScore(a: Map<string, number>, b: Map<string, number>): number {
  let score = 0
  for (const [token, weight] of a) {
    if (b.has(token)) score += weight
  }
  return score
}

function changeReason(
  earlier: SectionedCandidate,
  changed: SectionedCandidate,
): string {
  return (
    `决策变更：候选「${changed.item.text}」（${changed.section}）明确表示改换了决定，` +
    `可能取代了较早的候选「${earlier.item.text}」（${earlier.section}），` +
    `请人工检查后确认哪一项仍然有效，不要自动以最后一句为准。`
  )
}

/** Reason for a change warning with no identifiable earlier decision. */
function unpairedChangeReason(changed: SectionedCandidate): string {
  return (
    `决策变更：候选「${changed.item.text}」（${changed.section}）明确表示改换了决定，` +
    `但内容上无法确定它取代了哪一项较早决策（没有较早决策与它共享主题词），` +
    `请人工检查后确认哪一项仍然有效，不要自动以最后一句为准，也不要按最近的一条猜测。`
  )
}

/**
 * Detect explicit conflicts among sectioned candidates.
 * Returns [] when nothing explicitly conflicts. Never modifies input.
 *
 * Performance (FINDING-T011-01): the pairwise rules below only ever
 * fire for two candidates with the SAME normalised core, so
 * candidates are grouped by core first and only pairs inside a
 * group are compared. Per-candidate features (core, negation,
 * progress flags) are computed once, not once per pair. On the
 * review probe (20,000 chars / 511 distinct candidates) this is
 * ~1,800 ms -> a few ms; 100,000 chars ~39 s -> well under a
 * second. Worst case is still quadratic when very many candidates
 * share one core, but then every pair in the group is a genuine
 * candidate conflict, not wasted work.
 */
export function detectConflicts(
  candidates: readonly SectionedCandidate[],
): Conflict[] {
  const conflicts: Conflict[] = []
  const seen = new Set<string>()
  /**
   * Build (but do not yet append) a conflict, or null when this
   * exact (a, b, kind) triple was already reported.
   */
  const make = (
    kind: string,
    a: SectionedCandidate,
    b: SectionedCandidate,
    reasonOverride?: string,
    unpaired = false,
  ): Conflict | null => {
    const key = `${a.item.id}|${b.item.id}|${kind}`
    if (seen.has(key)) return null
    seen.add(key)
    const conflict: Conflict = {
      id: `conflict-${a.item.id}-${b.item.id}`,
      reason: reasonOverride ?? conflictReason(kind, a, b),
      a,
      b,
    }
    if (unpaired) conflict.unpairedChange = true
    return conflict
  }

  // Per-candidate features, computed once (FINDING-T011-01).
  const features = candidates.map((cand) => ({
    core: coreOf(cand.item.text),
    negation: hasNegation(cand.item.text),
    done: hasProgressDone(cand.item.text),
    notDone: hasProgressNotDone(cand.item.text),
  }))

  // Group non-rejected candidates by core; only same-core pairs can
  // conflict (all three pairwise rules are gated on core equality).
  // Empty cores never pair (same as the old loop's length check).
  const groups = new Map<string, number[]>()
  candidates.forEach((cand, index) => {
    if (cand.item.status === 'rejected') return
    const core = features[index].core
    if (core.length === 0) return
    const group = groups.get(core)
    if (group) group.push(index)
    else groups.set(core, [index])
  })

  // Pairwise rules, inside each core group only. Collect with sort
  // keys so the returned order matches the old (i, j) scan order.
  const pairResults: Array<{ conflict: Conflict; aIdx: number; bIdx: number }> = []
  for (const indices of groups.values()) {
    for (let x = 0; x < indices.length; x += 1) {
      for (let y = x + 1; y < indices.length; y += 1) {
        const i = indices[x]
        const j = indices[y]
        const a = candidates[i]
        const b = candidates[j]
        if (a.item.id === b.item.id) continue
        const fa = features[i]
        const fb = features[j]

        // 1. Same core, opposite negation (e.g. "使用 React" vs "不要使用 React").
        if (fa.negation !== fb.negation) {
          const conflict = make('显式否定冲突', a, b)
          if (conflict) pairResults.push({ conflict, aIdx: i, bIdx: j })
          continue
        }
        // 2. Decision vs prohibition on the same core, even without a
        //    negation token in the decision text.
        if (
          (a.section === 'decisions' && b.section === 'prohibitions') ||
          (a.section === 'prohibitions' && b.section === 'decisions')
        ) {
          const conflict = make('决策与禁止冲突', a, b)
          if (conflict) pairResults.push({ conflict, aIdx: i, bIdx: j })
          continue
        }
        // 3. Progress contradiction on the same core.
        if (a.section === 'progress' && b.section === 'progress') {
          if ((fa.done && fb.notDone) || (fa.notDone && fb.done)) {
            const conflict = make('进度矛盾冲突', a, b)
            if (conflict) pairResults.push({ conflict, aIdx: i, bIdx: j })
          }
        }
      }
    }
  }
  pairResults.sort((p, q) => p.aIdx - q.aIdx || p.bIdx - q.bIdx)
  for (const { conflict } of pairResults) conflicts.push(conflict)

  // 4. Explicit decision change (OBS-T010-05 / FINDING-T011-02):
  //    a later decision that carries a change marker may supersede
  //    an earlier decision. The earlier decision is the one with
  //    the highest shared-topic score (ties: most recent); below
  //    MIN_TOPIC_SCORE the warning is emitted unpaired instead of
  //    naming the most recent decision. Sectioned candidates arrive
  //    in section order with document order inside each section.
  //    No earlier decision → nothing reported. Rejected items are
  //    skipped, like in the pairwise loop above.
  const decisions = candidates.filter(
    (cand) => cand.section === 'decisions' && cand.item.status !== 'rejected',
  )
  for (const changed of decisions) {
    if (!CHANGE_MARKERS.some((marker) => changed.item.text.includes(marker))) continue
    const earlier = decisions.slice(0, decisions.indexOf(changed))
    if (earlier.length === 0) continue
    const changedTokens = topicTokens(changed.item.text)
    let best: SectionedCandidate | null = null
    let bestScore = 0
    for (const cand of earlier) {
      const score = topicScore(topicTokens(cand.item.text), changedTokens)
      if (best === null || score > bestScore) {
        best = cand
        bestScore = score
      }
    }
    if (best !== null && bestScore >= MIN_TOPIC_SCORE) {
      const conflict = make('决策变更', best, changed, changeReason(best, changed))
      if (conflict) conflicts.push(conflict)
    } else {
      const conflict = make(
        '决策变更（未配对）',
        changed,
        changed,
        unpairedChangeReason(changed),
        true,
      )
      if (conflict) conflicts.push(conflict)
    }
  }

  return conflicts
}
