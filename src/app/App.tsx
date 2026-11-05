/**
 * P011 Context Capsule — T008 page integration.
 * Full user flow (PROJECT_BOOK §5 FR01–FR14, §6):
 * paste → generate → edit/confirm/reject → preview → export
 * (Markdown/JSON) → import (JSON file) → clear (with confirmation).
 * State lives in memory only: no localStorage, no fetch, no
 * analytics, no upload. Download uses the browser Blob API;
 * copy uses navigator.clipboard with a textarea fallback.
 * Import reads a file the user explicitly selects, parses it
 * as data only, and validates it via importJSON (fails loudly).
 */
import { useMemo, useState } from 'react'
import { Workbench } from '../components/Workbench'
import { confirmItem, rejectItem, editItem, deleteItem, addManualItem } from '../core/capsule'
import { importJSON } from '../io/json'
import type { CapsuleSections, SectionKey } from '../core/types'
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
} from './workflow'

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for browsers without async clipboard permission.
    const area = document.createElement('textarea')
    area.value = text
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  }
}

export function App() {
  const [rawText, setRawText] = useState('')
  const [title, setTitle] = useState('')
  const [sections, setSections] = useState<CapsuleSections>(() => emptyWorkspace().sections)
  const [notice, setNotice] = useState('')
  const [importError, setImportError] = useState('')

  const conflicts = useMemo(() => computeConflicts(sections), [sections])
  const stats = useMemo(() => capsuleStats(sections), [sections])
  const state = useMemo(() => ({ rawText, title, sections }), [rawText, title, sections])
  const markdown = useMemo(() => previewMarkdown(state), [state])
  const hints = useMemo(() => sensitiveHints(rawText), [rawText])

  const handleGenerate = () => {
    setSections(generateSections(rawText))
    setNotice('已按规则生成七栏候选，请逐条确认。未确认内容不会导出。')
  }

  const handleClear = () => {
    setRawText('')
    setTitle('')
    setSections(emptyWorkspace().sections)
    setNotice('工作区已清空。')
  }

  const handleImportFile = (file: File) => {
    setImportError('')
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const capsule = importJSON(String(reader.result ?? ''))
        setTitle(capsule.title)
        setSections(capsule.sections)
        setNotice(`已导入胶囊“${capsule.title}”，共 ${capsuleStats(capsule.sections).totalCount} 条。`)
      } catch (error) {
        setImportError(`导入失败：${error instanceof Error ? error.message : '文件格式无效'}。文件未被修改，也没有内容被静默修复。`)
      }
    }
    reader.readAsText(file)
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', color: '#222', maxWidth: 1400, margin: '0 auto', padding: 16 }}>
      <h1>P011 对话续接胶囊 Context Capsule</h1>
      <p>
        本地优先 Web 应用：粘贴旧对话，规则生成七栏候选，你确认后导出 Markdown / JSON，到其他 AI 会话继续任务。
        不调用外部模型、不上传原始对话、不自动持久化（刷新后页面内存中的内容可能丢失，请导出保存）。
      </p>
      {hints.length > 0 && (
        <div role="note" aria-label="敏感信息提示" style={{ border: '1px solid #666', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          <p>
            本地风险提示：原文中发现 {hints.length} 处疑似敏感信息（邮箱/手机号常见模式），请在导出前检查、编辑或删除。
            该提示只覆盖常见模式，不保证完整识别所有敏感信息。
          </p>
          <ul>
            {hints.map((hint, index) => (
              <li key={`${hint.kind}-${hint.index}-${index}`}>
                {hint.kind === 'email' ? '疑似邮箱' : '疑似手机号'}：{hint.snippet}
              </li>
            ))}
          </ul>
        </div>
      )}
      {notice && (
        <p role="status" style={{ border: '1px solid #666', borderRadius: 8, padding: 12 }}>
          {notice}
        </p>
      )}
      <Workbench
        rawText={rawText}
        title={title}
        sections={sections}
        conflicts={conflicts}
        previewMarkdown={markdown}
        confirmedCount={stats.confirmedCount}
        totalCount={stats.totalCount}
        capsuleCharCount={stats.capsuleCharCount}
        onRawTextChange={setRawText}
        onTitleChange={setTitle}
        onGenerate={handleGenerate}
        onClearConfirmed={handleClear}
        sourceSnippetFor={(item) => sourceSnippetFor(rawText, item)}
        onConfirm={(section, id) => setSections((s) => confirmItem(s, section, id))}
        onReject={(section, id) => setSections((s) => rejectItem(s, section, id))}
        onEdit={(section, id, text) => setSections((s) => editItem(s, section, id, text))}
        onDelete={(section, id) => setSections((s) => deleteItem(s, section, id))}
        onAddManual={(section: SectionKey, text: string) =>
          setSections((s) =>
            addManualItem(s, section, { id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text }),
          )
        }
        onCopyMarkdown={() => {
          void copyText(markdown).then((ok) => setNotice(ok ? 'Markdown 已复制。' : '复制失败，请手动复制预览内容。'))
        }}
        onCopyPrompt={() => {
          void copyText(handoverPrompt(state)).then((ok) => setNotice(ok ? '续接提示词已复制。' : '复制失败，请手动复制预览内容。'))
        }}
        onDownloadMarkdown={() => download('context-capsule.md', markdown, 'text/markdown;charset=utf-8')}
        onDownloadJSON={() => download('context-capsule.json', previewJSON(state), 'application/json;charset=utf-8')}
      />
      <section aria-label="导入 JSON 胶囊" style={{ border: '1px solid #666', borderRadius: 8, padding: 12, marginTop: 16 }}>
        <h2>导入 JSON 胶囊</h2>
        <p>选择之前导出的 JSON 胶囊文件。导入会验证版本与结构，失败时不修改当前工作区、不静默修复。</p>
        <label>
          选择 JSON 文件
          <input
            aria-label="选择 JSON 文件"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
              e.target.value = ''
            }}
          />
        </label>
        {importError && (
          <p role="alert" style={{ color: '#900' }}>
            {importError}
          </p>
        )}
      </section>
      <footer>
        <p>
          施工状态：T001–T012 已完成；T011 独立审查复审 PASS（2026-11-05）。
          T010 人类参与部分（人工确认后交接质量、任务续接与整理耗时）未测量，不得宣称为已通过。
          终审未做，本产品不是已发布版本。离线运行指已加载页面断网可用，冷启动离线需本地 HTTP 服务（无 Service Worker）。
        </p>
      </footer>
    </main>
  )
}
