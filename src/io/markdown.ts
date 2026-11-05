/**
 * P011 Context Capsule — T007 Markdown export.
 * Spec PROJECT_BOOK §8 / §9 and IMPLEMENTATION_PLAN §7:
 * - Export only confirmed items; candidate/rejected items never
 *   enter the file (FR05, CC-08). This function filters defensively,
 *   even if it is handed a capsule that still holds candidates.
 * - All seven sections are always present, in fixed SECTION_KEYS
 *   order, input order within a section (deterministic export).
 * - An empty section renders as “未提供” (PROJECT_BOOK §8; note
 *   §9's example uses “暂无” for the same empty case — §8's rule
 *   is followed here and the difference is recorded in README).
 * - The original pasted dialogue is never included in the export.
 * - Markdown is plain text; no user content is executed.
 * - Item text is folded onto one line (FINDING-T011-05): a
 *   manual/edited item containing newlines could otherwise
 *   inject a forged `##` heading or `- ` list item into the
 *   seven-section structure. Newlines become single spaces;
 *   the item text itself is unchanged in state and in JSON.
 */
import type { Capsule } from '../core/types'
import { SECTION_KEYS } from '../core/types'
import { SECTION_LABELS } from '../components/labels'

export function exportMarkdown(capsule: Capsule): string {
  const lines: string[] = ['# Context Capsule']
  for (const key of SECTION_KEYS) {
    lines.push(`## ${SECTION_LABELS[key]}`)
    const confirmed = capsule.sections[key].filter((item) => item.status === 'confirmed')
    if (confirmed.length === 0) {
      lines.push('- 未提供')
    } else {
      for (const item of confirmed) {
        // Fold newlines to spaces (FINDING-T011-05): a newline
        // inside item text would otherwise start a new Markdown
        // line and could forge a heading or list item.
        lines.push(`- ${item.text.replace(/\r\n?|\n/g, ' ')}`)
      }
    }
  }
  return lines.join('\n') + '\n'
}
