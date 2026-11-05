/**
 * P011 Context Capsule — T006 preview pane.
 * Spec PROJECT_BOOK §6: the preview follows confirm state and
 * supports copying the handover prompt and downloading files.
 * The markdown itself is rendered as plain text (React-escaped),
 * never as HTML (PROJECT_BOOK §10).
 */

export interface PreviewPaneProps {
  markdown: string
  confirmedCount: number
  totalCount: number
  capsuleCharCount: number
  onCopyMarkdown: () => void
  onCopyPrompt: () => void
  onDownloadMarkdown: () => void
  onDownloadJSON: () => void
}

export function PreviewPane(props: PreviewPaneProps) {
  return (
    <section aria-label="交接预览">
      <h3>交接预览</h3>
      <p>
        已确认 {props.confirmedCount} / 共 {props.totalCount} 条；胶囊字符数 {props.capsuleCharCount}。
        仅已确认条目进入导出，未确认内容不会导出。
      </p>
      {props.markdown.trim().length === 0 ? (
        <p>暂无已确认内容。请先确认至少一条候选。</p>
      ) : (
        <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #888', borderRadius: 8, padding: 12, background: '#fff' }}>
          {props.markdown}
        </pre>
      )}
      <div>
        <button type="button" aria-label="复制 Markdown" onClick={props.onCopyMarkdown}>
          复制 Markdown
        </button>{' '}
        <button type="button" aria-label="复制续接提示词" onClick={props.onCopyPrompt}>
          复制续接提示词
        </button>{' '}
        <button type="button" aria-label="下载 Markdown" onClick={props.onDownloadMarkdown}>
          下载 Markdown
        </button>{' '}
        <button type="button" aria-label="下载 JSON" onClick={props.onDownloadJSON}>
          下载 JSON
        </button>
      </div>
    </section>
  )
}
