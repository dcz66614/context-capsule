import { describe, expect, it } from 'vitest'
import { detectConflicts } from '../src/core/conflicts'
import type { SectionedCandidate } from '../src/core/conflicts'
import type { CapsuleItem } from '../src/core/types'

function item(id: string, text: string, status: CapsuleItem['status'] = 'candidate'): CapsuleItem {
  return { id, text, origin: 'extracted', status }
}

function cand(section: SectionedCandidate['section'], id: string, text: string, status?: CapsuleItem['status']): SectionedCandidate {
  return { section, item: item(id, text, status) }
}

describe('detectConflicts (T004, CC-05)', () => {
  it('flags a decision/prohibition pair on the same action and names both', () => {
    const a = cand('decisions', 'a1', '决定使用 React')
    const b = cand('prohibitions', 'b1', '不要使用 React')
    const conflicts = detectConflicts([a, b])
    expect(conflicts.length).toBe(1)
    expect(conflicts[0].a.item.id).toBe('a1')
    expect(conflicts[0].b.item.id).toBe('b1')
    expect(conflicts[0].reason).toContain('决定使用 React')
    expect(conflicts[0].reason).toContain('不要使用 React')
  })

  it('flags progress contradictions on the same work', () => {
    const conflicts = detectConflicts([
      cand('progress', 'p1', '已完成测试'),
      cand('progress', 'p2', '测试尚未完成'),
    ])
    expect(conflicts.length).toBe(1)
    expect(conflicts[0].reason).toContain('已完成测试')
    expect(conflicts[0].reason).toContain('测试尚未完成')
  })

  it('does not flag unrelated items, and never deletes anything', () => {
    const input = [
      cand('decisions', 'a1', '决定使用 React'),
      cand('prohibitions', 'b1', '不要上传原始对话'),
      cand('facts', 'c1', '项目不依赖外部 API'),
    ]
    const before = JSON.stringify(input)
    expect(detectConflicts(input)).toEqual([])
    expect(JSON.stringify(input)).toBe(before)
    expect(input.length).toBe(3)
  })

  it('does not flag a conflict when one side is rejected', () => {
    expect(
      detectConflicts([
        cand('decisions', 'a1', '决定使用 React'),
        cand('prohibitions', 'b1', '不要使用 React', 'rejected'),
      ]),
    ).toEqual([])
  })

  it('does not treat the last sentence as true: both sides stay in the input', () => {
    const input = [
      cand('decisions', 'a1', '决定使用 React'),
      cand('decisions', 'a2', '决定不使用 React'),
    ]
    const conflicts = detectConflicts(input)
    expect(conflicts.length).toBeGreaterThanOrEqual(1)
    expect(input.map((c) => c.item.id)).toEqual(['a1', 'a2'])
  })
})

describe('detectConflicts decision-change pairing (T011-02, OBS-T010-05)', () => {
  it('does not name the wrong earlier decision when topics do not match (review probe)', () => {
    const conflicts = detectConflicts([
      cand('decisions', 'm1', '决定用 MySQL 存数据。'),
      cand('decisions', 'm2', '决定买十四寸屏幕。'),
      cand('decisions', 'm3', '决定改用 SQLite。'),
    ])
    expect(conflicts.length).toBe(1)
    // Unpaired: the change is reported, but no earlier decision is
    // named as the superseded one — the screen decision must NOT
    // be blamed for a database change.
    expect(conflicts[0].unpairedChange).toBe(true)
    expect(conflicts[0].a.item.id).toBe('m3')
    expect(conflicts[0].reason).toContain('改用 SQLite')
    expect(conflicts[0].reason).toContain('无法确定')
    expect(conflicts[0].reason).not.toContain('十四寸屏幕')
  })

  it('pairs a change with the earlier decision that shares its topic (D03 shape)', () => {
    const conflicts = detectConflicts([
      cand('decisions', 'd1', '最开始我决定用 MySQL 存文章数据。'),
      cand('decisions', 'd2', '后来我改主意了，决定改用 SQLite，这样部署简单。'),
      cand('decisions', 'd3', '主题一开始决定用深色主题。'),
      cand('decisions', 'd4', '后来觉得深色看久了累，决定改回浅色主题。'),
    ])
    expect(conflicts.length).toBe(2)
    // The theme change pairs with the theme decision (shared
    // topic: 主题/深色/浅色).
    const theme = conflicts.find((c) => c.b.item.id === 'd4')
    expect(theme).toBeDefined()
    expect(theme!.unpairedChange).toBeUndefined()
    expect(theme!.a.item.id).toBe('d3')
    expect(theme!.reason).toContain('深色主题')
    // The database change shares no topic token with either earlier
    // decision (SQLite vs MySQL is not a textual match), so it is
    // reported unpaired rather than guessed.
    const db = conflicts.find((c) => c.b.item.id === 'd2')
    expect(db).toBeDefined()
    expect(db!.unpairedChange).toBe(true)
    expect(db!.reason).not.toContain('深色主题')
  })

  it('pairs by shared topic even when an unrelated decision sits between', () => {
    const conflicts = detectConflicts([
      cand('decisions', 'd1', '决定用 React 做前端。'),
      cand('decisions', 'd2', '决定买十四寸屏幕。'),
      cand('decisions', 'd3', '决定改用 Vue 做前端。'),
    ])
    expect(conflicts.length).toBe(1)
    expect(conflicts[0].unpairedChange).toBeUndefined()
    expect(conflicts[0].a.item.id).toBe('d1')
    expect(conflicts[0].b.item.id).toBe('d3')
  })

  it('a change marker with no earlier decision reports nothing', () => {
    expect(
      detectConflicts([cand('decisions', 'x1', '决定改用 SQLite。')]),
    ).toEqual([])
  })

  it('a rejected earlier decision is not used as a pairing target', () => {
    expect(
      detectConflicts([
        cand('decisions', 'r1', '决定用 MySQL。', 'rejected'),
        cand('decisions', 'r2', '决定改用 SQLite。'),
      ]),
    ).toEqual([])
  })
})
