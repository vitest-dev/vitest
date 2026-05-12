import type { Page } from '@playwright/test'
import type { PreviewServer } from 'vite'
import type { Vitest } from 'vitest/node'
import assert from 'node:assert'
import { Writable } from 'node:stream'
import { expect } from '@playwright/test'
import { preview } from 'vite'
import { startVitest } from 'vitest/node'

type StartVitestFilters = Parameters<typeof startVitest>[1]
type StartVitestOptions = NonNullable<Parameters<typeof startVitest>[2]>
type PreviewOptions = Parameters<typeof preview>[0]

export async function startVitestUi(
  options: StartVitestOptions,
  filters: StartVitestFilters = [],
): Promise<{ vitest: Vitest; url: string }> {
  const stdout = new Writable({ write: (_, __, callback) => callback() })
  const stderr = new Writable({ write: (_, __, callback) => callback() })
  const vitest = await startVitest('test', filters, options, {}, { stdout, stderr })
  assert(vitest, 'Failed to start Vitest')

  const address = vitest.vite.httpServer?.address()
  assert(address && typeof address === 'object', 'Invalid server address')

  return {
    vitest,
    url: `http://localhost:${address.port}`,
  }
}

export async function startHtmlReportPreview(
  vitestOptions: StartVitestOptions,
  previewOptions: PreviewOptions,
  filters: StartVitestFilters = [],
): Promise<{ previewServer: PreviewServer; url: string }> {
  const stdout = new Writable({ write: (_, __, callback) => callback() })
  const stderr = new Writable({ write: (_, __, callback) => callback() })
  await startVitest('test', filters, vitestOptions, {}, { stdout, stderr })

  const previewServer = await preview(previewOptions)
  const address = previewServer.httpServer?.address()
  assert(address && typeof address === 'object', 'Invalid server address')

  return {
    previewServer,
    url: `http://localhost:${address.port}`,
  }
}

export function getExplorerItem(page: Page, name: string) {
  return page.getByTestId('explorer-item').and(page.getByLabel(name, { exact: true }))
}

export async function assertTestCounts(page: Page, options: { pass: number; fail: number }) {
  await expect.soft(page.getByTestId('tests-entry'))
    .toContainText(`${options.pass} Pass ${options.fail} Fail ${options.pass + options.fail} Total`)
}
