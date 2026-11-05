/**
 * P011 T009 E2E — offline flow (FR12, IMPLEMENTATION_PLAN §9).
 * The app must work with the network off, and must make NO request
 * to any host other than the local dev server. Requests are recorded
 * for the whole test and asserted — this is not a source-inspection
 * claim. Note: the page is loaded first (the dev server is local),
 * then the context goes offline and the core flow runs offline.
 */
import { expect, test } from '@playwright/test'
import { DECISION, PROHIBITION, confirmInSection, pasteAndGenerate, previewPre } from './helpers'

test('offline: core flow works with network off and makes no external request', async ({
  page,
  context,
}) => {
  const requests: string[] = []
  const offlineRequests: string[] = []
  let offline = false
  page.on('request', (request) => {
    requests.push(request.url())
    if (offline) offlineRequests.push(request.url())
  })

  await pasteAndGenerate(page)
  await expect(page.getByLabel('已作决策栏目').getByText(DECISION, { exact: true })).toBeVisible()

  // Go offline: no network from here on.
  offline = true
  await context.setOffline(true)
  try {
    // Confirm + edit while offline; preview must update with no network.
    await confirmInSection(page, '禁止事项')
    await expect(previewPre(page)).toContainText(PROHIBITION)

    const decisionCard = page.getByLabel('已作决策栏目').locator('article').first()
    await decisionCard.getByRole('button', { name: '编辑该条目' }).click()
    await decisionCard.getByLabel('编辑条目内容').fill('已经决定使用 React。')
    await decisionCard.getByRole('button', { name: '保存编辑' }).click()
    await confirmInSection(page, '已作决策')
    await expect(previewPre(page)).toContainText('已经决定使用 React。')

    // Clear while offline too.
    await page.getByRole('button', { name: '清空工作区' }).click()
    await page.getByRole('button', { name: '确认清空' }).click()
    await expect(page.getByLabel('原始对话文本')).toHaveValue('')
  } finally {
    await context.setOffline(false)
    offline = false
  }

  // Network record, printed for the acceptance log.
  console.log(`E2E-OFFLINE requests total=${requests.length} while-offline=${offlineRequests.length}`)
  console.log(`E2E-OFFLINE urls: ${JSON.stringify(requests)}`)
  // Every request was to the local dev server only — no external host.
  const localOnly =
    /^(wss?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:)/
  for (const url of requests) {
    expect(url).toMatch(localOnly)
  }
  // While offline, nothing was attempted to any non-local host
  // (the Vite dev HMR socket may retry locally; that is local traffic).
  for (const url of offlineRequests) {
    expect(url).toMatch(localOnly)
  }
  console.log(`E2E-OFFLINE while-offline urls: ${JSON.stringify(offlineRequests)}`)
})
