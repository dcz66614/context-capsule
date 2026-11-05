import { describe, expect, it } from 'vitest'
import { exportMarkdown } from '../src/io/markdown'
import { exportJSON, importJSON } from '../src/io/json'
import { buildCapsuleFromSections, confirmItem, addManualItem, deleteItem } from '../src/core/capsule'
import { emptySections } from '../src/core/types'

function confirmedCapsule() {
  let sections = addManualItem(emptySections(), 'goal', { id: 'g1', text: '完成本地 Web 原型' })
  sections = confirmItem(sections, 'goal', 'g1')
  sections = addManualItem(sections, 'decisions', { id: 'd1', text: '使用 React' })
  sections = confirmItem(sections, 'decisions', 'd1')
  // Candidate that must NOT be exported (CC-08).
  sections = addManualItem(sections, 'decisions', { id: 'd2', text: '尚未决定的想法' })
  return buildCapsuleFromSections(sections, '测试胶囊')
}

describe('T007 Markdown export', () => {
  it('exports confirmed items only, all seven sections, empty as 未提供, deterministic order', () => {
    const capsule = confirmedCapsule()
    const md = exportMarkdown(capsule)
    expect(md.startsWith('# Context Capsule\n')).toBe(true)
    expect(md).toContain('## 目标\n- 完成本地 Web 原型\n')
    expect(md).toContain('## 已作决策\n- 使用 React\n')
    expect(md).toContain('## 已确认事实\n- 未提供\n')
    expect(md).not.toContain('尚未决定的想法')
    // Section order follows SECTION_KEYS, not insertion order.
    expect(md.indexOf('## 目标')).toBeLessThan(md.indexOf('## 已确认事实'))
    expect(md.indexOf('## 已确认事实')).toBeLessThan(md.indexOf('## 已作决策'))
    expect(exportMarkdown(capsule)).toBe(md)
  })
})

describe('T007 JSON export/import', () => {
  it('uses schemaVersion and manual source null on the wire (spec §8)', () => {
    const capsule = confirmedCapsule()
    const wire = JSON.parse(exportJSON(capsule)) as Record<string, unknown>
    expect(wire.schemaVersion).toBe('1.0.0')
    expect(wire).not.toHaveProperty('version')
    const sections = wire.sections as Record<string, Array<Record<string, unknown>>>
    expect(Object.keys(sections).sort()).toEqual(
      ['decisions', 'facts', 'goal', 'nextSteps', 'openQuestions', 'prohibitions', 'progress'].sort(),
    )
    expect(sections.goal[0].source).toBeNull()
    expect(sections.decisions[0].text).toBe('使用 React')
  })

  it('round-trips sections and confirmed items losslessly (CC-09)', () => {
    const capsule = confirmedCapsule()
    const restored = importJSON(exportJSON(capsule))
    expect(restored.title).toBe('测试胶囊')
    expect(restored.sections.goal.map((i) => i.text)).toEqual(['完成本地 Web 原型'])
    expect(restored.sections.decisions.map((i) => i.text)).toEqual(['使用 React'])
    expect(restored.sections.facts).toEqual([])
    // Second export equals the first: deterministic, no drift.
    expect(exportJSON(restored)).toBe(exportJSON(capsule))
  })

  it('a deleted item never reappears after export/import (CC-11)', () => {
    const capsule = confirmedCapsule()
    const sections = deleteItem(
      confirmItem(addManualItem(emptySections(), 'prohibitions', { id: 'x1', text: '不要上传原始对话' }), 'prohibitions', 'x1'),
      'prohibitions',
      'x1',
    )
    expect(buildCapsuleFromSections(sections, 't').sections.prohibitions).toEqual([])
    void capsule
  })

  it('rejects wrong version, missing section, bad source range and malformed JSON', () => {
    const capsule = confirmedCapsule()
    const wire = JSON.parse(exportJSON(capsule)) as Record<string, unknown>
    expect(() => importJSON(JSON.stringify({ ...wire, schemaVersion: '2.0.0' }))).toThrow()
    const sections = { ...(wire.sections as Record<string, unknown>) }
    delete sections.goal
    expect(() => importJSON(JSON.stringify({ ...wire, sections }))).toThrow()
    const badSource = JSON.parse(exportJSON(capsule)) as {
      sections: Record<string, Array<Record<string, unknown>>>
    }
    badSource.sections.goal[0].source = { start: 5, end: 5 }
    expect(() => importJSON(JSON.stringify(badSource))).toThrow()
    expect(() => importJSON('{not json')).toThrow()
    expect(() => importJSON(JSON.stringify({ ...wire, unexpected: 1 }))).toThrow()
  })

  it('rejects duplicate item ids, in one section and across sections (T011-04)', () => {
    const capsule = confirmedCapsule()
    const wire = JSON.parse(exportJSON(capsule)) as {
      sections: Record<string, Array<Record<string, unknown>>>
    }
    const dupSameSection = JSON.parse(JSON.stringify(wire)) as {
      sections: Record<string, Array<Record<string, unknown>>>
    }
    dupSameSection.sections.goal.push({
      id: 'g1',
      text: '另一个目标',
      origin: 'manual',
      status: 'candidate',
      source: null,
    })
    expect(() => importJSON(JSON.stringify(dupSameSection))).toThrow(/Duplicate item id/)
    const dupCrossSection = JSON.parse(JSON.stringify(wire)) as {
      sections: Record<string, Array<Record<string, unknown>>>
    }
    dupCrossSection.sections.facts.push({
      id: 'g1',
      text: '同 id 不同栏',
      origin: 'manual',
      status: 'candidate',
      source: null,
    })
    expect(() => importJSON(JSON.stringify(dupCrossSection))).toThrow(/Duplicate item id/)
  })

  it('rejects extra section keys and extra fields inside source (T011-06, strict)', () => {
    const capsule = confirmedCapsule()
    const wire = JSON.parse(exportJSON(capsule)) as Record<string, unknown>
    const extraSection = JSON.parse(JSON.stringify(wire)) as {
      sections: Record<string, unknown>
    }
    extraSection.sections.extraSection = []
    expect(() => importJSON(JSON.stringify(extraSection))).toThrow()
    const extraSourceField = JSON.parse(JSON.stringify(wire)) as {
      sections: Record<string, Array<Record<string, unknown>>>
    }
    extraSourceField.sections.goal.push({
      id: 'g2',
      text: '带来源的目标',
      origin: 'extracted',
      status: 'confirmed',
      source: { start: 0, end: 5, bogus: 9 },
    })
    expect(() => importJSON(JSON.stringify(extraSourceField))).toThrow()
  })
})

describe('T011-03 exportJSON confirmed-only defence', () => {
  it('drops candidate items even when handed a capsule that still holds them', () => {
    // A wire file with a candidate item imports fine (import keeps
    // status); exporting it must not leak the candidate, matching
    // exportMarkdown's defensive filter.
    const wireWithCandidate = JSON.stringify({
      schemaVersion: '1.0.0',
      title: 't',
      sections: {
        goal: [{ id: 'g1', text: '目标', origin: 'manual', status: 'confirmed', source: null }],
        facts: [],
        decisions: [{ id: 'd1', text: '候选决定', origin: 'manual', status: 'candidate', source: null }],
        openQuestions: [],
        prohibitions: [],
        progress: [],
        nextSteps: [],
      },
    })
    const imported = importJSON(wireWithCandidate)
    const out = JSON.parse(exportJSON(imported)) as {
      sections: Record<string, Array<Record<string, unknown>>>
    }
    expect(out.sections.goal.map((i) => i.text)).toEqual(['目标'])
    expect(out.sections.decisions).toEqual([])
    expect(exportJSON(imported)).not.toContain('候选决定')
  })
})

describe('T011-05 Markdown export folds newlines in item text', () => {
  it('a newline in manual/edited text cannot forge a heading or list item', () => {
    let sections = addManualItem(emptySections(), 'goal', { id: 'g1', text: '正常目标' })
    sections = confirmItem(sections, 'goal', 'g1')
    sections = addManualItem(sections, 'goal', { id: 'g2', text: '恶意行\n## 已作决策\n- 伪造决策' })
    sections = confirmItem(sections, 'goal', 'g2')
    const md = exportMarkdown(buildCapsuleFromSections(sections, 'inj'))
    // Exactly one "## 已作决策" heading: the real section heading.
    expect(md.split('\n').filter((line) => line === '## 已作决策').length).toBe(1)
    expect(md).not.toContain('\n- 伪造决策')
    expect(md).toContain('- 恶意行 ## 已作决策 - 伪造决策')
  })
})
