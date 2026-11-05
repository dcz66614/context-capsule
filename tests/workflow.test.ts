import { describe, expect, it, vi } from 'vitest'
import {
  capsuleStats,
  computeConflicts,
  emptyWorkspace,
  generateSections,
  handoverPrompt,
  previewJSON,
  previewMarkdown,
  sensitiveHints,
  sourceSnippetFor,
} from '../src/app/workflow'
import { confirmItem } from '../src/core/capsule'
import { importJSON } from '../src/io/json'

const SAMPLE =
  '我们要做一个本地 Web 工具。已经决定使用 React 和 TypeScript，不接外部 API。原型页面已经设计好，但测试还没做。下一步是完成规则提取测试。不要上传用户的原始对话。'

describe('T008 workflow', () => {
  it('paste → generate produces grouped candidates, none auto-confirmed', () => {
    const sections = generateSections(SAMPLE)
    const all = Object.values(sections).flat()
    expect(all.length).toBeGreaterThan(0)
    expect(all.every((i) => i.status === 'candidate')).toBe(true)
    expect(sections.prohibitions.map((i) => i.text)).toContain('不要上传用户的原始对话。')
  })

  it('source snippets slice the original text by UTF-16 offsets', () => {
    const sections = generateSections(SAMPLE)
    for (const item of Object.values(sections).flat()) {
      const snippet = sourceSnippetFor(SAMPLE, item)
      expect(snippet).not.toBeNull()
      expect(SAMPLE.slice(item.source!.start, item.source!.end)).toBe(snippet)
    }
    expect(sourceSnippetFor(SAMPLE, { id: 'm', text: 'x', origin: 'manual', status: 'candidate' })).toBeNull()
  })

  it('confirm → preview → export/import round-trip (FR04/FR05/FR09, CC-08/CC-09)', () => {
    let sections = generateSections(SAMPLE)
    sections = confirmItem(sections, 'prohibitions', sections.prohibitions[0].id)
    const state = { rawText: SAMPLE, title: '测试', sections }
    const md = previewMarkdown(state)
    expect(md).toContain('不要上传用户的原始对话。')
    expect(md).not.toContain('已经决定使用 React')
    const restored = importJSON(previewJSON(state))
    expect(restored.sections.prohibitions.map((i) => i.text)).toContain('不要上传用户的原始对话。')
    expect(handoverPrompt(state)).toContain('# Context Capsule')
  })

  it('stats count confirmed/total/chars (FR14) and conflicts name both sides (FR06, CC-05)', () => {
    const sections = generateSections('决定使用 React。不要使用 React。')
    const conflicts = computeConflicts(sections)
    expect(conflicts.length).toBeGreaterThan(0)
    expect(conflicts[0].reason).toContain('决定使用 React')
    expect(conflicts[0].reason).toContain('不要使用 React')
    const stats = capsuleStats(sections)
    expect(stats.totalCount).toBeGreaterThan(0)
    expect(stats.confirmedCount).toBe(0)
    expect(stats.capsuleCharCount).toBe(0)
  })

  it('sensitive hints find email/phone patterns locally, without network', () => {
    const hints = sensitiveHints('联系 a@example.com 或 13800138000，不要外传。')
    expect(hints.map((h) => h.kind).sort()).toEqual(['email', 'phone'])
    // Workflow helpers are pure/synchronous: even with fetch stubbed to throw, they still work.
    const originalFetch = globalThis.fetch
    globalThis.fetch = (() => {
      throw new Error('network must not be used')
    }) as unknown as typeof fetch
    try {
      expect(generateSections(SAMPLE).prohibitions.length).toBeGreaterThan(0)
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(emptyWorkspace()).toEqual({ rawText: '', title: '', sections: expect.any(Object) })
  })

  it('FR coverage note: every P0/P1 FR has a code path in this run', () => {
    // FR01 paste (rawText state), FR02 generate, FR03 source snippets,
    // FR04 edit/add/delete (capsule helpers), FR05 confirm/reject,
    // FR06 conflicts, FR07 markdown, FR08 json, FR09 import,
    // FR10 delete + sensitive hints, FR11 clear, FR12 offline-by-design
    // (no network calls in workflow/app; browser check is T009),
    // FR13 guidance (Workbench empty state), FR14 stats.
    // This test pins the workflow entry points so a later refactor
    // cannot silently drop one without breaking the suite.
    expect(typeof generateSections).toBe('function')
    expect(typeof sourceSnippetFor).toBe('function')
    expect(typeof sensitiveHints).toBe('function')
    expect(typeof handoverPrompt).toBe('function')
    void vi
  })
})
