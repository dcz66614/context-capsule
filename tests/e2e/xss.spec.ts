/**
 * P011 T009 E2E — malicious HTML is escaped, never executed (CC-10,
 * PROJECT_BOOK §10). Pasting a <script> payload must render it as
 * inert text in the candidate card and in the preview, must not fire
 * alert/dialog, and must not inject a <script> element into the DOM.
 */
import { expect, test } from '@playwright/test'
import { previewPre } from './helpers'

const PAYLOAD = '<script>alert(1)</script>不要上传原文。'

test('malicious HTML is escaped, not executed', async ({ page }) => {
  let dialogShown = false
  page.on('dialog', async (dialog) => {
    dialogShown = true
    await dialog.dismiss()
  })
  // Belt and braces: if a script did execute, window.alert would fire.
  // (Set after navigation, before Generate renders the payload.)
  await page.goto('/')
  await page.getByLabel('原始对话文本').fill('目标是做一个本地 Web 工具。' + PAYLOAD)
  await page.evaluate(() => {
    ;(window as unknown as { __xssFired: boolean }).__xssFired = false
    window.alert = () => {
      ;(window as unknown as { __xssFired: boolean }).__xssFired = true
    }
  })
  await page.getByRole('button', { name: '生成七栏草稿' }).click()
  await page
    .getByLabel('目标栏目')
    .getByText('目标是做一个本地 Web 工具。', { exact: true })
    .waitFor()

  // The payload lands in the prohibitions column as inert text.
  const card = page.getByLabel('禁止事项栏目').locator('article').first()
  await expect(card.getByText(PAYLOAD, { exact: true })).toBeVisible()
  const cardHtml = await card.evaluate((el) => el.innerHTML)
  expect(cardHtml).toContain('&lt;script&gt;')
  expect(cardHtml).not.toContain('<script>alert(1)</script>')

  // No <script> element in the document carries the payload.
  const scriptTexts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('script')).map((s) => s.textContent ?? ''),
  )
  expect(scriptTexts.join('\n')).not.toContain('alert(1)')

  // Confirm it: the preview <pre> also shows it as escaped text.
  await page
    .getByLabel('禁止事项栏目')
    .getByRole('button', { name: '确认该条目' })
    .first()
    .click()
  const pre = previewPre(page)
  await expect(pre).toContainText(PAYLOAD)
  const preHtml = await pre.evaluate((el) => el.innerHTML)
  expect(preHtml).toContain('&lt;script&gt;')
  expect(preHtml).not.toContain('<script>alert(1)</script>')

  // Nothing executed: no dialog, no alert call.
  expect(dialogShown).toBe(false)
  expect(
    await page.evaluate(
      () => (window as unknown as { __xssFired: boolean }).__xssFired,
    ),
  ).toBe(false)
})
