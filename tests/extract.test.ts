import { describe, expect, it } from 'vitest'
import { extractCandidates, segmentText, groupCandidatesBySection } from '../src/lib/extract'
import { parseCapsule, capsuleItemSchema } from '../src/lib/schema'
import { newCapsule, SECTION_KEYS } from '../src/lib/types'

describe('segmentText', () => {
  it('preserves UTF-16 code-unit offsets: slice equals segment text', () => {
    const source = '目标是做一个胶囊。不要保存密码。下一步做什么？已完成原型。'
    for (const segment of segmentText(source)) {
      expect(source.slice(segment.start, segment.end)).toBe(segment.text)
      expect(segment.end).toBeGreaterThan(segment.start)
    }
    expect(segmentText(source).length).toBeGreaterThanOrEqual(4)
  })

  it('handles empty input', () => {
    expect(segmentText('')).toEqual([])
    expect(segmentText('   \n\n  ')).toEqual([])
  })

  it('keeps distinct offsets for repeated sentences', () => {
    const source = '不要保存密码。不要保存密码。'
    const segments = segmentText(source)
    expect(segments.length).toBe(2)
    expect(segments[0].start).not.toBe(segments[1].start)
    expect(source.slice(segments[1].start, segments[1].end)).toBe('不要保存密码。')
  })
})

describe('extractCandidates', () => {
  it('never auto-confirms: all items are extracted candidates', () => {
    const items = extractCandidates('目标是做一个胶囊。决定用本地存储。不要保存密码。')
    expect(items.length).toBeGreaterThanOrEqual(3)
    for (const item of items) {
      expect(item.origin).toBe('extracted')
      expect(item.status).toBe('candidate')
    }
  })

  it('does not modify its input', () => {
    const source = '目标是做一个胶囊。不要保存密码。'
    const before = source
    extractCandidates(source)
    expect(source).toBe(before)
  })

  it('suggests prohibitions and questions before generic facts', () => {
    const items = extractCandidates('不要保存密码。下一步做什么？')
    const grouped = groupCandidatesBySection(items, '不要保存密码。下一步做什么？')
    expect(grouped.prohibitions.map((i) => i.text)).toContain('不要保存密码。')
    expect(grouped.openQuestions.map((i) => i.text)).toContain('下一步做什么？')
  })

  it('deduplicates identical segments in the same section', () => {
    const items = extractCandidates('不要保存密码。不要保存密码。')
    expect(items.filter((i) => i.text === '不要保存密码。').length).toBe(1)
  })

  it('runs fast on 20,000 Chinese characters', () => {
    const source = '目标是做一个胶囊，不要保存密码，决定用本地存储。'.repeat(800)
    const start = Date.now()
    const items = extractCandidates(source)
    expect(Date.now() - start).toBeLessThan(2000)
    expect(items.length).toBeGreaterThan(0)
  })
})

describe('schema', () => {
  it('accepts a valid capsule with all seven sections', () => {
    const capsule = newCapsule('test')
    expect(Object.keys(capsule.sections).sort()).toEqual([...SECTION_KEYS].sort())
    expect(parseCapsule(capsule)).toEqual(capsule)
  })

  it('rejects a wrong version and a missing section', () => {
    const capsule = newCapsule('test') as unknown as Record<string, unknown>
    expect(() => parseCapsule({ ...capsule, version: '2.0.0' })).toThrow()
    const sections = { ...(capsule.sections as Record<string, unknown>) }
    delete sections.goal
    expect(() => parseCapsule({ ...capsule, sections })).toThrow()
  })

  it('rejects an item with an invalid source range', () => {
    expect(() =>
      capsuleItemSchema.parse({
        id: 'x',
        text: 't',
        origin: 'manual',
        status: 'confirmed',
        source: { start: 5, end: 5 },
      }),
    ).toThrow()
  })
})
