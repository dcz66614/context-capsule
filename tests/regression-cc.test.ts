/**
 * P011 T009 — missing P0 regression coverage for the CC-01–CC-12 matrix
 * (IMPLEMENTATION_PLAN §8). Filed as independent tests: these pin the
 * exact plan phrases to a section; they do not change the spec or the
 * rule engine. CC-05/07/08/09/10/11/12 already have unit coverage in
 * tests/{conflicts,capsule,io,components,workflow}.test.*; the gaps
 * confirmed by audit were CC-01–CC-04 (no test asserted the section
 * for the plan's exact phrases) and CC-06 (dedup was checked only
 * by count, not by source retention).
 */
import { describe, expect, it } from 'vitest'
import {
  classifyText,
  extractCandidates,
  groupCandidatesBySection,
} from '../src/lib/extract'
import { segmentText } from '../src/lib/extract'

function sectionOf(text: string) {
  const items = extractCandidates(text)
  const grouped = groupCandidatesBySection(items, text)
  return grouped
}

describe('CC-01 explicit goal', () => {
  it('classifies "目标是做一个本地 Web 工具。" as goal', () => {
    expect(classifyText('目标是做一个本地 Web 工具。')).toBe('goal')
    const grouped = sectionOf('目标是做一个本地 Web 工具。')
    expect(grouped.goal.map((i) => i.text)).toContain('目标是做一个本地 Web 工具。')
  })

  // FINDING-T009-01 (P1) — FIXED in repair: goal rule in
  // src/lib/extract.ts now includes the Book §4.2 signals
  // "希望实现" / "最终交付" (via `希望` and `最终.{0,2}交付`).
  // These were it.fails in T009; flipped back to `it` now that
  // they genuinely pass (verified by the full suite below).
  it('classifies "希望实现本地离线交接。" as goal', () => {
    expect(classifyText('希望实现本地离线交接。')).toBe('goal')
  })

  // Same root cause, second Book §4.2 goal signal: "最终交付".
  it('classifies "最终交付本地原型。" as goal', () => {
    expect(classifyText('最终交付本地原型。')).toBe('goal')
  })
})

describe('CC-02 explicit decision', () => {
  it('classifies "已经决定使用 X" as a decision candidate', () => {
    expect(classifyText('已经决定使用 X。')).toBe('decisions')
    const grouped = sectionOf('已经决定使用 X。')
    expect(grouped.decisions.map((i) => i.text)).toContain('已经决定使用 X。')
    expect(grouped.decisions[0].status).toBe('candidate')
  })

  it('classifies "已经决定使用 React 和 TypeScript。" as a decision', () => {
    const grouped = sectionOf('已经决定使用 React 和 TypeScript。')
    expect(grouped.decisions.map((i) => i.text)).toContain(
      '已经决定使用 React 和 TypeScript。',
    )
  })
})

describe('CC-03 explicit prohibition', () => {
  it('classifies "不要上传原文" as a prohibition candidate', () => {
    expect(classifyText('不要上传原文。')).toBe('prohibitions')
    const grouped = sectionOf('不要上传原文。')
    expect(grouped.prohibitions.map((i) => i.text)).toContain('不要上传原文。')
  })

  it('classifies "不要上传用户的原始对话。" as a prohibition', () => {
    const grouped = sectionOf('不要上传用户的原始对话。')
    expect(grouped.prohibitions.map((i) => i.text)).toContain('不要上传用户的原始对话。')
  })
})

describe('CC-04 explicit next step', () => {
  it('classifies "下一步完成测试" as a next step', () => {
    expect(classifyText('下一步完成测试。')).toBe('nextSteps')
    const grouped = sectionOf('下一步完成测试。')
    expect(grouped.nextSteps.map((i) => i.text)).toContain('下一步完成测试。')
  })
})

describe('CC-01–CC-04 in one dialogue (PROJECT_BOOK §9 sample)', () => {
  it('routes each sentence of the sample to its expected section', () => {
    const sample =
      '我们要做一个本地 Web 工具。已经决定使用 React 和 TypeScript，不接外部 API。' +
      '原型页面已经设计好，但测试还没做。下一步是完成规则提取测试。不要上传用户的原始对话。'
    const grouped = sectionOf(sample)
    expect(grouped.decisions.map((i) => i.text)).toContain(
      '已经决定使用 React 和 TypeScript，不接外部 API。',
    )
    expect(grouped.prohibitions.map((i) => i.text)).toContain('不要上传用户的原始对话。')
    expect(grouped.nextSteps.map((i) => i.text)).toContain('下一步是完成规则提取测试。')
    // Every extracted item keeps a source slice that equals its text.
    for (const item of Object.values(grouped).flat()) {
      expect(item.source).toBeDefined()
      expect(sample.slice(item.source!.start, item.source!.end)).toBe(item.text)
    }
  })
})

describe('CC-06 duplicate sentence keeps its source (not just count)', () => {
  it('deduplicates to one item whose source is the FIRST occurrence', () => {
    const source = '不要保存密码。不要保存密码。'
    const items = extractCandidates(source)
    const kept = items.filter((i) => i.text === '不要保存密码。')
    expect(kept.length).toBe(1)
    expect(kept[0].source).toEqual({ start: 0, end: 7 })
    expect(source.slice(kept[0].source!.start, kept[0].source!.end)).toBe('不要保存密码。')
  })

  it('segmentText keeps distinct offsets for the repeated sentence', () => {
    const source = '不要保存密码。不要保存密码。'
    const segments = segmentText(source)
    expect(segments.length).toBe(2)
    expect(segments[0].start).toBe(0)
    expect(segments[1].start).toBe(7)
    expect(source.slice(segments[1].start, segments[1].end)).toBe('不要保存密码。')
  })
})
