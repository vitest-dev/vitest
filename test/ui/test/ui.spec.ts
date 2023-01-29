import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { browserErrors, killProcess, page, withLoad } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = '5173'
const reportPort = '5174'

it('should load ui', async () => {
  const ui = execaCommand(`npx vitest --ui --api.port ${uiPort} --open false --reporter=html --outputFile=html/index.html`, {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'pipe',
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
    killProcess(ui)
  }
}, 60_000)

it('should load report', async () => {
  // preview report
  const html = execaCommand(`npx vite preview --outDir html --port ${reportPort} --strict-port --base __vitest__`, {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'pipe',
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
    killProcess(html)
  }
}, 60_000)
