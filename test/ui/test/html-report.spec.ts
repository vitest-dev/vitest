import { resolve } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { execaCommandSync } from 'execa'
import { browserErrors, page, startServerCommand } from '../setup'

const root = resolve(__dirname, '../fixtures')
const reportPort = 9001

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
    `npx vite preview --outDir html --strict-port --base /__vitest__/ --port ${reportPort}`,
    `http://localhost:${reportPort}/__vitest__/`,
  )

  return exit
})

it('should load report', async () => {
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
  expect(browserErrors.length).toEqual(0)
}, 60_000)
