import { resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { browserErrors, page, ports, startServerCommand } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = ports.ui

beforeAll(async () => {
  const exit = await startServerCommand(
    root,
    `npx vitest --ui --open false --api.port ${port} --watch --allowOnly`,
    `http://localhost:${port}/__vitest__/`,
  )

  return exit
})

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

it('no error happen', () => {
  expect(browserErrors.length).toEqual(0)
})
