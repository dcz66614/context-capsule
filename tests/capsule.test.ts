import { describe, expect, it } from 'vitest'
import {
  addManualItem,
  buildCapsule,
  buildCapsuleFromSections,
  clearCapsule,
  confirmItem,
  deleteItem,
  editItem,
  rejectItem,
} from '../src/core/capsule'
import type { SectionedCandidate } from '../src/core/conflicts'
import { emptySections } from '../src/core/types'

function cand(section: SectionedCandidate['section'], id: string, text: string, status: 'candidate' | 'confirmed' | 'rejected'): SectionedCandidate {
  return { section, item: { id, text, origin: 'extracted', status } }
}

describe('capsule state (T005)', () => {
  it('buildCapsule only accepts confirmed items (CC-08)', () => {
    const capsule = buildCapsule(
      [
        cand('goal', 'g1', '完成本地 Web 原型', 'confirmed'),
        cand('decisions', 'd1', '使用 React', 'candidate'),
        cand('decisions', 'd2', '不接外部 API', 'rejected'),
      ],
      'test',
    )
    expect(capsule.sections.goal.map((i) => i.text)).toEqual(['完成本地 Web 原型'])
    expect(capsule.sections.decisions).toEqual([])
    expect(capsule.version).toBe('1.0.0')
  })

  it('keeps deterministic section order and input order within a section', () => {
    const capsule = buildCapsule(
      [
        cand('nextSteps', 'n1', '完成测试', 'confirmed'),
        cand('goal', 'g1', '完成原型', 'confirmed'),
        cand('goal', 'g2', '不接外部 API', 'confirmed'),
      ],
      'test',
    )
    expect(Object.keys(capsule.sections)).toEqual([
      'goal', 'facts', 'decisions', 'openQuestions', 'prohibitions', 'progress', 'nextSteps',
    ])
    expect(capsule.sections.goal.map((i) => i.id)).toEqual(['g1', 'g2'])
    const again = buildCapsule(
      [
        cand('nextSteps', 'n1', '完成测试', 'confirmed'),
        cand('goal', 'g1', '完成原型', 'confirmed'),
        cand('goal', 'g2', '不接外部 API', 'confirmed'),
      ],
      'test',
    )
    expect(again.sections).toEqual(capsule.sections)
  })

  it('confirm/reject/edit are pure and keep source as a review clue', () => {
    const sections = emptySections()
    const withItem = addManualItem(sections, 'decisions', { id: 'd1', text: '使用 React' })
    expect(sections.decisions).toEqual([])
    const confirmed = confirmItem(withItem, 'decisions', 'd1')
    expect(withItem.decisions[0].status).toBe('candidate')
    expect(confirmed.decisions[0].status).toBe('confirmed')
    const edited = editItem(confirmed, 'decisions', 'd1', '使用 React 和 TypeScript')
    expect(edited.decisions[0].text).toBe('使用 React 和 TypeScript')
    expect(rejectItem(edited, 'decisions', 'd1').decisions[0].status).toBe('rejected')
  })

  it('manual items are marked manual with no source (CC-07)', () => {
    const sections = addManualItem(emptySections(), 'goal', { id: 'm1', text: '手工目标' })
    expect(sections.goal[0].origin).toBe('manual')
    expect(sections.goal[0].status).toBe('candidate')
    expect(sections.goal[0].source).toBeUndefined()
  })

  it('deleted items do not reappear in a build (CC-11)', () => {
    const sections = confirmItem(
      addManualItem(emptySections(), 'prohibitions', { id: 'x1', text: '不要上传原始对话' }),
      'prohibitions',
      'x1',
    )
    const afterDelete = deleteItem(sections, 'prohibitions', 'x1')
    expect(afterDelete.prohibitions).toEqual([])
    expect(buildCapsuleFromSections(afterDelete, 'test').sections.prohibitions).toEqual([])
  })

  it('clear restores empty sections (CC-12)', () => {
    const sections = confirmItem(
      addManualItem(emptySections(), 'goal', { id: 'g1', text: '完成原型' }),
      'goal',
      'g1',
    )
    expect(clearCapsule(sections)).toEqual(emptySections())
  })
})
