import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { Workbench } from '../src/components/Workbench'
import { emptySections } from '../src/core/types'
import type { Conflict } from '../src/core/conflicts'

const noop = () => undefined
const sections = emptySections()
sections.decisions = [
  { id: 'd1', text: '使用 React', origin: 'extracted', status: 'candidate', source: { start: 0, end: 5 } },
]
sections.prohibitions = [
  { id: 'p1', text: '<script>alert(1)</script>', origin: 'manual', status: 'candidate' },
]

describe('T006 Workbench rendering', () => {
  it('shows three columns, section labels, status text and source snippet', () => {
    const html = renderToString(
      <Workbench
        rawText="使用 React。"
        title="测试胶囊"
        sections={sections}
        conflicts={[]}
        previewMarkdown="# Context Capsule"
        confirmedCount={0}
        totalCount={2}
        capsuleCharCount={10}
        onRawTextChange={noop}
        onTitleChange={noop}
        onGenerate={noop}
        onClearConfirmed={noop}
        sourceSnippetFor={(item) => (item.source ? '使用 React。' : null)}
        onConfirm={noop}
        onReject={noop}
        onEdit={noop}
        onDelete={noop}
        onAddManual={noop}
        onCopyMarkdown={noop}
        onCopyPrompt={noop}
        onDownloadMarkdown={noop}
        onDownloadJSON={noop}
      />,
    )
    expect(html).toContain('01 · 原始对话')
    expect(html).toContain('02 · 七栏核对')
    expect(html).toContain('03 · 交接预览')
    expect(html).toContain('已作决策')
    expect(html).toContain('待确认')
    expect(html).toContain('原文片段')
    expect(html).toContain('原始文本字符数')
  })

  it('escapes user content instead of rendering it as HTML (CC-10)', () => {
    const html = renderToString(
      <Workbench
        rawText="x"
        title="t"
        sections={sections}
        conflicts={[]}
        previewMarkdown=""
        confirmedCount={0}
        totalCount={2}
        capsuleCharCount={0}
        onRawTextChange={noop}
        onTitleChange={noop}
        onGenerate={noop}
        onClearConfirmed={noop}
        sourceSnippetFor={() => null}
        onConfirm={noop}
        onReject={noop}
        onEdit={noop}
        onDelete={noop}
        onAddManual={noop}
        onCopyMarkdown={noop}
        onCopyPrompt={noop}
        onDownloadMarkdown={noop}
        onDownloadJSON={noop}
      />,
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('conflict warnings name both candidates', () => {
    const conflict: Conflict = {
      id: 'c1',
      reason: '显式否定冲突：候选「使用 React」（decisions）与候选「不要使用 React」（prohibitions）相互矛盾，请人工检查后确认其中一项，不要自动以最后一句为准。',
      a: { section: 'decisions', item: sections.decisions[0] },
      b: { section: 'prohibitions', item: { id: 'p2', text: '不要使用 React', origin: 'extracted', status: 'candidate' } },
    }
    const html = renderToString(
      <Workbench
        rawText="x"
        title="t"
        sections={sections}
        conflicts={[conflict]}
        previewMarkdown=""
        confirmedCount={0}
        totalCount={2}
        capsuleCharCount={0}
        onRawTextChange={noop}
        onTitleChange={noop}
        onGenerate={noop}
        onClearConfirmed={noop}
        sourceSnippetFor={() => null}
        onConfirm={noop}
        onReject={noop}
        onEdit={noop}
        onDelete={noop}
        onAddManual={noop}
        onCopyMarkdown={noop}
        onCopyPrompt={noop}
        onDownloadMarkdown={noop}
        onDownloadJSON={noop}
      />,
    )
    expect(html).toContain('使用 React')
    expect(html).toContain('不要使用 React')
  })
})
