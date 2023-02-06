import { resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { execaCommandSync } from 'execa'
import { browserErrors, page, ports, startServerCommand } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = ports.report

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
    `npx vite preview --outDir html --strict-port --base /__vitest__/ --port ${port}`,
    `http://localhost:${port}/__vitest__/`,
  )

  return exit
})

it('should load report', async () => {
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
  expect(browserErrors.length).toEqual(0)
}, 60_000)

it('dashboard', async () => {
  expect(await page.textContent('[aria-labelledby]')).toBe('1 Pass 0 Fail 1 Total ')
})

it('file detail', async () => {
  await page.click('.details-panel span')

  await page.click('[data-testid=btn-report]')
  expect(await page.textContent('[data-testid=report]')).toMatch('All tests passed in this file')
  expect(await page.textContent('[data-testid=filenames]')).toMatch('sample.test.ts')

  await page.click('[data-testid=btn-graph]')
  expect(await page.textContent('[data-testid=graph] text')).toMatch('sample.test.ts')

  await page.click('[data-testid=btn-console]')
  expect(await page.textContent('[data-testid=console] pre')).toMatch('log test')
})
