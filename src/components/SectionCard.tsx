/**
 * P011 Context Capsule — T006 section card.
 * One grouped card per fixed section (PROJECT_BOOK §6): items,
 * plus a manual-add form (FR04). Empty sections render an explicit
 * empty state, never a missing section (PROJECT_BOOK §8).
 */
import { useState } from 'react'
import type { CapsuleItem, SectionKey } from '../core/types'
import { CandidateCard } from './CandidateCard'
import { SECTION_LABELS } from './labels'

export interface SectionCardProps {
  section: SectionKey
  items: CapsuleItem[]
  sourceSnippetFor: (item: CapsuleItem) => string | null
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  onEdit: (id: string, text: string) => void
  onDelete: (id: string) => void
  onAddManual: (text: string) => void
}

export function SectionCard(props: SectionCardProps) {
  const [draft, setDraft] = useState('')
  const label = SECTION_LABELS[props.section]
  return (
    <section aria-label={`${label}栏目`} style={{ border: '1px solid #666', borderRadius: 8, padding: 12, marginBottom: 12 }}>
      <h3 style={{ marginTop: 0 }}>
        {label}（{props.items.length} 条）
      </h3>
      {props.items.length === 0 ? (
        <p>本栏暂无条目。</p>
      ) : (
        props.items.map((item) => (
          <CandidateCard
            key={item.id}
            item={item}
            sectionLabel={label}
            sourceSnippet={props.sourceSnippetFor(item)}
            onConfirm={() => props.onConfirm(item.id)}
            onReject={() => props.onReject(item.id)}
            onEdit={(text) => props.onEdit(item.id, text)}
            onDelete={() => props.onDelete(item.id)}
          />
        ))
      )}
      <div>
        <label>
          手动添加{label}条目
          <input
            aria-label={`手动添加${label}条目`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: 4 }}
          />
        </label>
        <button
          type="button"
          aria-label={`添加${label}条目`}
          disabled={draft.trim().length === 0}
          onClick={() => {
            props.onAddManual(draft.trim())
            setDraft('')
          }}
        >
          添加
        </button>
      </div>
    </section>
  )
}
