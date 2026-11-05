/**
 * P011 Context Capsule — T003 segment / extract rule engine.
 * Pure TypeScript, no external API, no auto-confirm: every extracted
 * item is a `candidate` for human confirmation. Extract never modifies
 * its input string; it only returns new objects with UTF-16 code-unit
 * offsets into the original text.
 */

export interface TextSegment {
  text: string
  start: number
  end: number
}

/**
 * Split into segments at paragraph breaks, then at sentence boundaries
 * (Chinese 。！？ and ASCII .!? followed by whitespace or end). Offsets
 * are tracked by scanning forward from the previous segment end, so
 * repeated identical sentences keep their own correct offsets.
 *
 * FINDING-T010-01 (P1): an ASCII "." or "!" is NOT always a sentence
 * boundary. A dot between two ASCII word characters belongs to an
 * email ("test@example.com"), an IP address ("192.168.1.100"), a
 * decimal ("3.5") or a version ("1.2.3"); an "!" glued to a token
 * ("Test1234!，…") is part of that token, not a sentence end. The
 * old regex split at every ASCII "." / "!" and shredded D06 into
 * fragments, losing the server-address constraint entirely.
 * Boundaries are therefore decided per delimiter (see
 * isSentenceBoundary); a lone newline also ends a segment, as the
 * old regex did. Fragments that are punctuation only (e.g. the tail
 * of an ellipsis) are dropped, matching the old behaviour.
 */
const ASCII_WORD_CHAR = /[A-Za-z0-9]/
const CHINESE_PUNCT = /[，。、；：]/

function isSentenceBoundary(paragraph: string, i: number): boolean {
  const ch = paragraph[i]
  if (ch === '。' || ch === '！' || ch === '？') return true
  if (ch === '!' || ch === '?') {
    // Not a boundary when glued to a token: "Test1234!，…" (password),
    // "?id=1" (URL query). A boundary at end of paragraph or before
    // whitespace / a Chinese character ("Hello! 明天见。").
    const next = paragraph[i + 1]
    if (next === undefined) return true
    if (ASCII_WORD_CHAR.test(next) || CHINESE_PUNCT.test(next)) return false
    return true
  }
  if (ch === '.') {
    // Dot between two ASCII word characters is part of an email, IP,
    // decimal or version — never a boundary. Any other dot ends the
    // sentence ("Hello world. Next…" / "完成了.下一步").
    const prev = paragraph[i - 1]
    const next = paragraph[i + 1]
    if (
      prev !== undefined &&
      next !== undefined &&
      ASCII_WORD_CHAR.test(prev) &&
      ASCII_WORD_CHAR.test(next)
    ) {
      return false
    }
    return true
  }
  return false
}

export function segmentText(source: string): TextSegment[] {
  const segments: TextSegment[] = []
  let cursor = 0
  const paragraphs = source.split(/\n\s*\n/)
  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      cursor += paragraph.length + 2
      continue
    }
    const paraStart = source.indexOf(paragraph, cursor)
    const start = paraStart >= 0 ? paraStart : cursor
    let segStartIdx = 0
    const push = (raw: string, index: number) => {
      if (raw.trim().length === 0) return
      if (!/[A-Za-z0-9\u4e00-\u9fff]/.test(raw)) return
      const leading = raw.length - raw.trimStart().length
      const trailing = raw.length - raw.trimEnd().length
      segments.push({
        text: raw.trim(),
        start: start + index + leading,
        end: start + index + raw.length - trailing,
      })
    }
    for (let i = 0; i < paragraph.length; i++) {
      if (paragraph[i] === '\n') {
        push(paragraph.slice(segStartIdx, i), segStartIdx)
        segStartIdx = i + 1
      } else if (isSentenceBoundary(paragraph, i)) {
        push(paragraph.slice(segStartIdx, i + 1), segStartIdx)
        segStartIdx = i + 1
      }
    }
    if (segStartIdx < paragraph.length) push(paragraph.slice(segStartIdx), segStartIdx)
    cursor = start + paragraph.length
  }
  return segments
}

import type { CapsuleItem, SectionKey } from './types'

interface Rule {
  section: SectionKey
  pattern: RegExp
  /**
   * If present, the rule does NOT match when this pattern matches.
   * Used for prospective / not-yet-made decisions (FINDING-T010-03):
   * a bare "决定" is not a made decision when it says "decide later"
   * ("再决定"), "not yet decided" ("还没决定"), or asks which option
   * ("决定买哪一台").
   */
  exclude?: RegExp
}

function ruleMatches(rule: Rule, text: string): boolean {
  if (!rule.pattern.test(text)) return false
  if (rule.exclude && rule.exclude.test(text)) return false
  return true
}

// Priority order matters: a segment gets exactly one suggested section,
// the first matching rule wins. Prohibitions and questions outrank
// generic statements so key constraints are not lost in `facts`.
const RULES: Rule[] = [
  // FINDING-T010-02 (P1): "要不要…" is a question, not a ban. The
  // 不要 inside 要不要 must not trigger this rule (negative
  // lookbehind on 不要 only); every other 不要 / 禁止 / 不能 case
  // is unchanged, so "不要上传原文。" still lands here.
  { section: 'prohibitions', pattern: /(?:(?<!要)不要|禁止|不能|不允许|切勿|never|do not|don't|forbidden|must not)/i },
  // FINDING-T010-04 (P2, open-question half): "还没决定 / 还没想好 /
  // 还没有定" are unresolved, not facts. (The ？ alternative already
  // covered "要不要…？" once T010-02 stopped it being a prohibition.)
  { section: 'openQuestions', pattern: /[？?]|(待确认|未定|疑问|待定|还没决定|还未决定|尚未决定|未决定|还没想好|还没有定|还没定|open question|TODO|待讨论)/ },
  {
    section: 'decisions',
    pattern: /(决定|确定|采用|选定|选择了|decided|decision|we chose|agreed)/,
    // FINDING-T010-03 (P1): "目标是先试一节课再决定报不报。" is a
    // goal, "下一步去实体店摸一下真机，再决定。" is a next step, and
    // "目标是这周末之前决定买哪一台。" is a goal — in all three the
    // 决定 is prospective, not a decision already made. The exclude
    // keeps genuine decisions ("已经决定使用 X", "决定改用 SQLite",
    // "决定优先考虑十四寸屏幕") matching as before.
    exclude: /(再决定|还没决定|还未决定|尚未决定|未决定|决定[^。！？，、；]{0,6}[哪吗是否])/,
  },
  // Progress rule also accepts 已经完成 / 已经实现 (the natural
  // phrasing): without them, "最终交付的版本已经完成。" would be
  // stolen by the new goal rule below, since progress is checked
  // first but its pattern only matched contiguous 已完成. This
  // matches src/core/conflicts.ts PROGRESS_DONE, which already
  // lists 已经完成 / 已实现 as done signals.
  //
  // FINDING-T010-04 (P2, progress half): "已经写了两千字" and
  // "已经整理了一半" are progress, as are bare "完成了" ("本季度
  // 完成了三个项目") and not-started signals ("支付功能还没有开始
  // 做"). The 已经+verb list is deliberately narrow — a broad
  // "已经 + any verb" rule would also flip D11-C6 "已经看了三台"
  // (gold standard: facts) to progress. "完成了" (with 了) is safe
  // against next steps: "下一步完成支付功能" has no 了, so it
  // still routes to nextSteps.
  { section: 'progress', pattern: /(已完成|已经完成|已做|已经做|已经写|已经整理|完成了|还没有开始|还没开始|尚未开始|还没做|尚未完成|未完成|进度|已实现|已经实现|done|completed|in progress|进展)/ },
  { section: 'nextSteps', pattern: /(下一步|接下来|待办|需要做|next step|next steps|to do|follow[- ]up)/ },
  // Goal signals per PROJECT_BOOK §4.2: 目标是、希望实现、最终交付.
  // `希望` covers 希望实现 / 希望达成; `最终.{0,2}交付` covers
  // 最终交付 / 最终要交付. Bare `交付` is deliberately NOT added:
  // "已经交付…" is a completed fact, not a goal.
  { section: 'goal', pattern: /(目标|目的|要做|想要|希望|最终.{0,2}交付|goal|objective|aim)/ },
]

/** Classify one segment's text with the same priority rules extract uses. */
export function classifyText(text: string): SectionKey {
  return RULES.find((rule) => ruleMatches(rule, text))?.section ?? 'facts'
}

/** Extract candidate items only. Never auto-confirms. */
export function extractCandidates(source: string): CapsuleItem[] {
  const segments = segmentText(source)
  const seen = new Set<string>()
  const items: CapsuleItem[] = []
  segments.forEach((segment, index) => {
    const section = RULES.find((rule) => ruleMatches(rule, segment.text))?.section ?? 'facts'
    const dedupeKey = `${section}:${segment.text}`
    if (seen.has(dedupeKey)) return
    seen.add(dedupeKey)
    items.push({
      id: `extracted-${index}`,
      text: segment.text,
      origin: 'extracted',
      status: 'candidate',
      source: { start: segment.start, end: segment.end },
    })
  })
  return items
}

/** Group extracted candidates by their suggested section (for UI/tests). */
export function groupCandidatesBySection(
  items: CapsuleItem[],
  source: string,
): Record<SectionKey, CapsuleItem[]> {
  const grouped: Record<SectionKey, CapsuleItem[]> = {
    goal: [],
    facts: [],
    decisions: [],
    openQuestions: [],
    prohibitions: [],
    progress: [],
    nextSteps: [],
  }
  for (const item of items) {
    const section =
      RULES.find((rule) => ruleMatches(rule, item.text))?.section ?? 'facts'
    void source
    grouped[section].push(item)
  }
  return grouped
}
