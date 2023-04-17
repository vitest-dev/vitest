import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { execaCommandSync } from 'execa'
import { browserErrors, isWindows, page, ports, startServerCommand, untilUpdated } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = ports.report

// TODO: fix flakyness on windows
describe.skipIf(isWindows)('html report', () => {
  beforeAll(async () => {
    execaCommandSync('npx vitest run --reporter=html --outputFile=html/index.html', {
      cwd: root,
      env: {
        ...process.env,
        CI: 'true',
        NO_COLOR: 'true',
      },
    })

    const exit = await startServerCommand(
      root,
      `npx vite preview --outDir html --strict-port --port ${port}`,
      `http://localhost:${port}/`,
    )

    return exit
  })

  it('dashboard', async () => {
    await untilUpdated(() => page.textContent('[aria-labelledby]'), '1 Pass 0 Fail 1 Total ')
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
