import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export function getExplorerItem(page: Page, name: string) {
  return page.getByTestId('explorer-item').and(page.getByLabel(name, { exact: true }))
}

export async function assertTestCounts(page: Page, options: { pass: number; fail: number }) {
  await expect.soft(page.getByTestId('tests-entry'))
    .toContainText(`${options.pass} Pass ${options.fail} Fail ${options.pass + options.fail} Total`)
}
