import type { Page } from '@playwright/test'
import type { InlineConfig, PreviewServer } from 'vite'
import type { CliOptions, Vitest } from 'vitest/node'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { Writable } from 'node:stream'
import { expect } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

export async function startVitestUi(
  cliOptions: CliOptions,
  viteOverrides: InlineConfig = {},
): Promise<{ vitest: Vitest; url: string }> {
  // silence Vitest logs
  const stdout = new Writable({ write: (_, __, callback) => callback() })
  const stderr = new Writable({ write: (_, __, callback) => callback() })
  const vitest = await startVitest('test', undefined, cliOptions, viteOverrides, { stdout, stderr })

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

export async function openExplorerFileItem(page: Page, name: string) {
  const item = getExplorerItem(page, name)
  await item.hover()
  await item.getByTestId('btn-open-details').click()
}

export async function assertDownloadAttachment(
  page: Page,
  options: {
    name: string
    suggestedFilename: string
    content: string
  },
) {
  const annotation = page.getByRole('note').filter({ hasText: options.name })
  const downloadPromise = page.waitForEvent('download')
  await annotation.getByRole('link').click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe(options.suggestedFilename)
  const downloadPath = await download.path()
  expect(readFileSync(downloadPath, 'utf-8')).toBe(options.content)
}

export async function assertImageAttachment(
  page: Page,
  options: {
    name: string
  },
) {
  const annotation = page.getByRole('note').filter({ hasText: options.name })
  await expect(annotation.getByRole('link')).toHaveAttribute('href', /.+/)
  await expect(annotation.getByRole('img')).not.toHaveJSProperty('naturalWidth', 0)
}
