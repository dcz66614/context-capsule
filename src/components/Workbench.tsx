/**
 * P011 Context Capsule — T006 three-column workbench.
 * Spec PROJECT_BOOK §6: desktop three columns, mobile vertical
 * steps (via the media query below). Column 1: raw text with
 * char count, clear and generate buttons. Column 2: seven-section
 * grouped cards. Column 3: handover preview. Clearing uses an
 * in-page confirmation panel, never an immediate wipe (FR11).
 * All user text is rendered by React (escaped); this component
 * makes no network request and stores nothing outside props.
 */
import { useState } from 'react'
import type { CapsuleItem, CapsuleSections, SectionKey } from '../core/types'
import { SECTION_KEYS } from '../core/types'
import type { Conflict } from '../core/conflicts'
import { SectionCard } from './SectionCard'
import { ConflictWarnings } from './ConflictWarnings'
import { PreviewPane } from './PreviewPane'

export interface WorkbenchProps {
  rawText: string
  title: string
  sections: CapsuleSections
  conflicts: Conflict[]
  previewMarkdown: string
  confirmedCount: number
  totalCount: number
  capsuleCharCount: number
  onRawTextChange: (text: string) => void
  onTitleChange: (title: string) => void
  onGenerate: () => void
  onClearConfirmed: () => void
  sourceSnippetFor: (item: CapsuleItem) => string | null
  onConfirm: (section: SectionKey, id: string) => void
  onReject: (section: SectionKey, id: string) => void
  onEdit: (section: SectionKey, id: string, text: string) => void
  onDelete: (section: SectionKey, id: string) => void
  onAddManual: (section: SectionKey, text: string) => void
  onCopyMarkdown: () => void
  onCopyPrompt: () => void
  onDownloadMarkdown: () => void
  onDownloadJSON: () => void
}

export function Workbench(props: WorkbenchProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const hasAnyItem = SECTION_KEYS.some((key) => props.sections[key].length > 0)
  return (
    <div>
      <style>{`.cc-workbench{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) minmax(0,1fr);gap:16px}@media (max-width:800px){.cc-workbench{grid-template-columns:minmax(0,1fr)}}`}</style>
      <div className="cc-workbench">
        <section aria-label="原始对话">
          <h2>01 · 原始对话</h2>
          <p>粘贴旧会话、摘要或项目笔记。原始对话默认只保存在当前页面内存中，不会自动上传或持久化。</p>
          <label>
            胶囊标题
            <input
              aria-label="胶囊标题"
              value={props.title}
              onChange={(e) => props.onTitleChange(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <label>
            原始对话文本
            <textarea
              aria-label="原始对话文本"
              value={props.rawText}
              onChange={(e) => props.onRawTextChange(e.target.value)}
              rows={16}
              style={{ display: 'block', width: '100%', marginTop: 4 }}
            />
          </label>
          <p>原始文本字符数：{props.rawText.length}</p>
          <button type="button" aria-label="生成七栏草稿" disabled={props.rawText.trim().length === 0} onClick={props.onGenerate}>
            生成草稿
          </button>{' '}
          <button type="button" aria-label="清空工作区" onClick={() => setConfirmingClear(true)}>
            清空
          </button>
          {confirmingClear && (
            <div role="dialog" aria-label="确认清空工作区" style={{ border: '1px solid #666', borderRadius: 8, padding: 12, marginTop: 8 }}>
              <p>确认清空吗？原始文本和所有候选、确认状态都会被清除，无法恢复。</p>
              <button
                type="button"
                aria-label="确认清空"
                onClick={() => {
                  props.onClearConfirmed()
                  setConfirmingClear(false)
                }}
              >
                确认清空
              </button>{' '}
              <button type="button" aria-label="取消清空" onClick={() => setConfirmingClear(false)}>
                取消
              </button>
            </div>
          )}
        </section>
        <section aria-label="七栏核对">
          <h2>02 · 七栏核对</h2>
          <ConflictWarnings conflicts={props.conflicts} />
          {!hasAnyItem && (
            <div>
              <p>还没有候选。操作步骤：</p>
              <ol>
                <li>在左侧粘贴旧对话或摘要。</li>
                <li>点“生成草稿”，系统按规则生成七栏候选。</li>
                <li>逐条确认、拒绝、编辑或删除，再导出。</li>
              </ol>
              <p>未确认内容不会进入导出；系统不会把推测包装成事实。</p>
            </div>
          )}
          {SECTION_KEYS.map((key) => (
            <SectionCard
              key={key}
              section={key}
              items={props.sections[key]}
              sourceSnippetFor={props.sourceSnippetFor}
              onConfirm={(id) => props.onConfirm(key, id)}
              onReject={(id) => props.onReject(key, id)}
              onEdit={(id, text) => props.onEdit(key, id, text)}
              onDelete={(id) => props.onDelete(key, id)}
              onAddManual={(text) => props.onAddManual(key, text)}
            />
          ))}
        </section>
        <section aria-label="交接预览区">
          <h2>03 · 交接预览</h2>
          <PreviewPane
            markdown={props.previewMarkdown}
            confirmedCount={props.confirmedCount}
            totalCount={props.totalCount}
            capsuleCharCount={props.capsuleCharCount}
            onCopyMarkdown={props.onCopyMarkdown}
            onCopyPrompt={props.onCopyPrompt}
            onDownloadMarkdown={props.onDownloadMarkdown}
            onDownloadJSON={props.onDownloadJSON}
          />
        </section>
      </div>
    </div>
  )
}
