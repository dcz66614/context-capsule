/**
 * P011 Context Capsule — T006 shared section labels.
 * Spec PROJECT_BOOK §4.1 / §9: fixed seven sections, deterministic
 * order, Chinese headings. These labels are the only section names
 * the UI may display; the internal keys never change (plan §1).
 */
import type { SectionKey } from '../core/types'

export const SECTION_LABELS: Record<SectionKey, string> = {
  goal: '目标',
  facts: '已确认事实',
  decisions: '已作决策',
  openQuestions: '未解决问题',
  prohibitions: '禁止事项',
  progress: '当前进度',
  nextSteps: '下一步',
}

export const STATUS_LABELS: Record<'candidate' | 'confirmed' | 'rejected', string> = {
  candidate: '待确认',
  confirmed: '已确认',
  rejected: '已拒绝',
}
