import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { browserErrors, isWindows, page, ports, startServerCommand, untilUpdated } from '../setup'

import { runVitest } from '../../test-utils'

const root = resolve(__dirname, '../fixtures')
const port = ports.report

// TODO: fix flakyness on windows
describe.skipIf(isWindows)('html report', () => {
  beforeAll(async () => {
    await runVitest({ root, reporters: 'html', outputFile: 'html/index.html' })

    const exit = await startServerCommand(
      `pnpm exec vite preview --outDir fixtures/html --strict-port --port ${port}`,
      `http://localhost:${port}/`,
    )

    return exit
  })

  describe('dashboard', async () => {
    it('summary', async () => {
      await untilUpdated(() => page.textContent('[aria-labelledby]'), '1 Pass 0 Fail 1 Total ')
    })

    it('unhandled errors', async () => {
      await untilUpdated(
        () => page.textContent('[data-testid=unhandled-errors]'),
        'Vitest caught 2 errors during the test run. This might cause false positive tests. '
        + 'Resolve unhandled errors to make sure your tests are not affected.',
      )
      await untilUpdated(() => page.textContent('[data-testid=unhandled-errors-details]'), 'Error: error')
      await untilUpdated(() => page.textContent('[data-testid=unhandled-errors-details]'), 'Unknown Error: 1')
    })
  })

  describe('file detail', async () => {
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

  it('no error happen', () => {
    expect(browserErrors.length).toEqual(0)
  })
})
