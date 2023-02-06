import { resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { browserErrors, page, ports, startServerCommand } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = ports.ui

beforeAll(async () => {
  const exit = await startServerCommand(
    root,
    `npx vitest --ui --open false --api.port ${port}`,
    `http://localhost:${port}/__vitest__/`,
  )

  return exit
})

it('should load ui', async () => {
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
})

it('no error happen', () => {
  expect(browserErrors.length).toEqual(0)
})
