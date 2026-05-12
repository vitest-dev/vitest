import type { Page } from '@playwright/test'
import type { InlineConfig, PreviewServer } from 'vite'
import type { CliOptions, Vitest } from 'vitest/node'
import assert from 'node:assert'
import { Writable } from 'node:stream'
import { expect } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

export async function startVitestUi(
  cliOptions: CliOptions,
): Promise<{ vitest: Vitest; url: string }> {
  const stdout = new Writable({ write: (_, __, callback) => callback() })
  const stderr = new Writable({ write: (_, __, callback) => callback() })
  const vitest = await startVitest('test', undefined, cliOptions, {}, { stdout, stderr })

  const address = vitest.vite.httpServer?.address()
  assert(address && typeof address === 'object', 'Invalid server address')

  return {
    vitest,
    url: `http://localhost:${address.port}`,
  }
}

export async function startHtmlReportPreview(
  cliOptions: CliOptions,
  previewOptions: InlineConfig,
): Promise<{ previewServer: PreviewServer; url: string }> {
  const stdout = new Writable({ write: (_, __, callback) => callback() })
  const stderr = new Writable({ write: (_, __, callback) => callback() })
  await startVitest('test', undefined, cliOptions, {}, { stdout, stderr })

  const previewServer = await preview(previewOptions)
  const address = previewServer.httpServer?.address()
  assert(address && typeof address === 'object', 'Invalid server address')

  return {
    previewServer,
    url: `http://localhost:${address.port}`,
  }
}

export async function assertTestCounts(page: Page, { pass, fail }: { pass: number; fail: number }) {
  await expect
    .soft(page.getByTestId('tests-entry'))
    .toContainText(
      `${pass} Pass ${fail} Fail ${pass + fail} Total`,
    )
}

export function getExplorerItem(page: Page, name: string) {
  return page.getByTestId('explorer-item').and(page.getByLabel(name, { exact: true }))
}

export async function openExplorerItem(page: Page, name: string) {
  await getExplorerItem(page, name).click()
}
