/** Shared helpers for P011 T009 Playwright E2E specs. */
import type { Page } from '@playwright/test'

export const SAMPLE =
  '目标是做一个本地 Web 工具。已经决定使用 React 和 TypeScript，不接外部 API。' +
  '原型页面已经设计好，但测试还没做。下一步是完成规则提取测试。不要上传用户的原始对话。'

export const DECISION = '已经决定使用 React 和 TypeScript，不接外部 API。'
export const PROHIBITION = '不要上传用户的原始对话。'
export const NEXT_STEP = '下一步是完成规则提取测试。'

/** Paste SAMPLE and generate candidates; waits until the goal card appears. */
export async function pasteAndGenerate(page: Page, text = SAMPLE) {
  await page.goto('/')
  await page.getByLabel('原始对话文本').fill(text)
  await page.getByRole('button', { name: '生成七栏草稿' }).click()
  await page.getByLabel('目标栏目').getByText('目标是做一个本地 Web 工具。', { exact: true }).waitFor()
}

/** Confirm the first item in the named section card. */
export async function confirmInSection(page: Page, sectionLabel: string) {
  await page
    .getByLabel(`${sectionLabel}栏目`)
    .getByRole('button', { name: '确认该条目' })
    .first()
    .click()
}

/** The handover preview <pre> element. */
export function previewPre(page: Page) {
  return page.getByLabel('交接预览区').locator('pre')
}
