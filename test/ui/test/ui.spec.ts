import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { execa } from 'execa'
import { browserErrors, page, withLoad } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = '5173'
const reportPort = '5174'

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
  const url = `http://localhost:${uiPort}/__vitest__/`
  try {
    await withLoad(url)
    await page.goto(url)
    expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    ui.cancel()
  }
}, 60_000)

it('should load report', async () => {
  // preview report
  const html = execa('npx', ['vite', 'preview', '--outDir', 'html', '--port', reportPort, '--strict-port', '--base', '__vitest__'], {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'inherit',
  })

  html.catch(e => e)

  const url = `http://localhost:${reportPort}/__vitest__/`

  try {
    await withLoad(url)
    await page.goto(url)
    expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    html.cancel()
  }
}, 60_000)
