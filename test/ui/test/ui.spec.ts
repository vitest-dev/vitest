import { resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { browserErrors, page, startServerCommand } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = 9000

beforeAll(async () => {
  const exit = await startServerCommand(
    root,
    `npx vitest --ui --open false --api.port ${uiPort}`,
    `http://localhost:${uiPort}/__vitest__/`,
  )

  return exit
})

it('should load ui', async () => {
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
  expect(browserErrors.length).toEqual(0)
}, 60_000)
