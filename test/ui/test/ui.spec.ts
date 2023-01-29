import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import kill from 'kill-port'
import { execaCommand } from 'execa'
import { browserErrors, killProcess, page, withRetry } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = 5173
const reportPort = 5174

it.each([
  ['ui', `npx vitest --ui --api.port ${uiPort} --open false --reporter=html --outputFile=html/index.html`, uiPort],
  ['report', `npx vite preview --outDir html --strict-port --base __vitest__ --port ${reportPort}`, reportPort],
])('should load %s', async (_, command, port) => {
  await kill(uiPort)
  const subProcess = execaCommand(command, {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'pipe',
  })

  subProcess.catch(e => e)
  const url = `http://localhost:${port}/__vitest__/`
  try {
    await withRetry(async () => {
      await page.goto(url)
    })
    expect(await (await page.$('#app'))?.innerHTML()).not.toBe('')
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    killProcess(subProcess)
  }
}, 60_000)
