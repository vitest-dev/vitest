import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { browserErrors, page, ports, startServerCommand, untilUpdated } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = ports.ui

beforeAll(async () => {
  if (process.platform === 'win32')
    return

  const exit = await startServerCommand(
    root,
    `npx vitest --ui --open false --api.port ${port} --watch --allowOnly`,
    `http://localhost:${port}/__vitest__/`,
  )

  return exit
})

it.runIf(process.platform !== 'win32')('dashboard', async () => {
  await untilUpdated(() => page.textContent('[aria-labelledby]'), '1 Pass 0 Fail 1 Total ')
})

describe.runIf(process.platform !== 'win32')('file detail', async () => {
  beforeAll(async () => {
    await page.click('.details-panel span')
  })

  it('report', async () => {
    await page.click('[data-testid=btn-report]')
    await untilUpdated(() => page.textContent('[data-testid=report]'), 'All tests passed in this file')
    await untilUpdated(() => page.textContent('[data-testid=filenames]'), 'sample.test.ts')
  })

  it('graph', async () => {
    await page.click('[data-testid=btn-graph]')
    expect(page.url()).toMatch('graph')
    await untilUpdated(() => page.textContent('[data-testid=graph] text'), 'sample.test.ts')
  })

  it('console', async () => {
    await page.click('[data-testid=btn-console]')
    expect(page.url()).toMatch('console')
    await untilUpdated(() => page.textContent('[data-testid=console] pre'), 'log test')
  })
})

it.runIf(process.platform !== 'win32')('no error happen', () => {
  expect(browserErrors.length).toEqual(0)
})
