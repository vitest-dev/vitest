import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { execa } from 'execa'
import { browserErrors, page, withRetry } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = '9527'
const reportPort = '9528'

it('should load ui', async () => {
  const ui = execa('npx', ['vitest', '--ui', '--api.port', uiPort, '--open', 'false', '--reporter=html', '--outputFile=html/index.html'], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'inherit',
  })

  ui.catch(e => e)

  await withRetry(async () => {
    await page.goto(`http://localhost:${uiPort}/__vitest__/`)
  })
  expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
  expect(browserErrors.length).toEqual(0)

  ui.cancel()
})

it('should load report', async () => {
  // preview report
  const html = execa('npx', ['vite', 'preview', '--outDir', 'html', '--port', reportPort], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'inherit',
  })

  html.catch(e => e)

  await withRetry(async () => {
    await page.goto(`http://localhost:${reportPort}/__vitest__/`)
  })
  expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
  expect(browserErrors.length).toEqual(0)

  html.cancel()
})
