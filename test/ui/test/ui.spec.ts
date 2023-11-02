import { beforeAll, describe, expect, it } from 'vitest'
import { browserErrors, isWindows, page, ports, startServerCommand, untilUpdated } from '../setup'

const port = ports.ui

// TODO: fix flakyness on windows
describe.skipIf(isWindows)('ui', () => {
  beforeAll(async () => {
    const exit = await startServerCommand(
    `pnpm exec vitest --root ./fixtures --ui --open false --api.port ${port} --watch --allowOnly`,
    `http://localhost:${port}/__vitest__/`,
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
        'Vitest caught 1 error during the test run. This might cause false positive tests. '
        + 'Resolve unhandled errors to make sure your tests are not affected.',
      )
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
