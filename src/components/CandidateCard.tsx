/**
 * P011 Context Capsule — T006 candidate card.
 * Spec PROJECT_BOOK §6: each candidate shows content, source,
 * status and edit actions. Text is rendered by React (escaped),
 * never as executable HTML (PROJECT_BOOK §10, CC-10). Status is
 * shown as clear text, never by colour alone.
 */
import { useState } from 'react'
import type { CapsuleItem } from '../core/types'
import { STATUS_LABELS } from './labels'

export interface CandidateCardProps {
  item: CapsuleItem
  sectionLabel: string
  /** Snippet sliced from the original text by the item's source offsets, or null for manual items. */
  sourceSnippet: string | null
  onConfirm: () => void
  onReject: () => void
  onEdit: (text: string) => void
  onDelete: () => void
}

export function CandidateCard(props: CandidateCardProps) {
  const { item, sectionLabel, sourceSnippet } = props
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(item.text)

  return (
    <article
      aria-label={`${sectionLabel}条目，状态：${STATUS_LABELS[item.status]}`}
      style={{ border: '1px solid #888', borderRadius: 8, padding: 12, marginBottom: 8, background: '#fff' }}
    >
      {editing ? (
        <div>
          <label>
            编辑条目内容
            <textarea
              aria-label="编辑条目内容"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <button
            type="button"
            aria-label="保存编辑"
            disabled={draft.trim().length === 0}
            onClick={() => {
              props.onEdit(draft.trim())
              setEditing(false)
            }}
          >
            保存
          </button>{' '}
          <button
            type="button"
            aria-label="取消编辑"
            onClick={() => {
              setDraft(item.text)
              setEditing(false)
            }}
          >
            取消
          </button>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 4px 0' }}>{item.text}</p>
          <p style={{ margin: '0 0 4px 0', fontSize: 13 }}>
            状态：{STATUS_LABELS[item.status]}；来源：{item.origin === 'manual' ? '手动输入' : '自动提取'}
          </p>
          {sourceSnippet !== null && (
            <p style={{ margin: '0 0 8px 0', fontSize: 13 }}>
              原文片段：{sourceSnippet}
            </p>
          )}
          <div>
            <button type="button" aria-label="确认该条目" disabled={item.status === 'confirmed'} onClick={props.onConfirm}>
              确认
            </button>{' '}
            <button type="button" aria-label="拒绝该条目" disabled={item.status === 'rejected'} onClick={props.onReject}>
              拒绝
            </button>{' '}
            <button type="button" aria-label="编辑该条目" onClick={() => { setDraft(item.text); setEditing(true) }}>
              编辑
            </button>{' '}
            <button type="button" aria-label="删除该条目" onClick={props.onDelete}>
              删除
            </button>
          </div>
        </>
      )}
    </article>
  )
}
