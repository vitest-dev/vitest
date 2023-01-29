import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import kill from 'kill-port'
import { execaCommand } from 'execa'
import { browserErrors, killProcess, page, withRetry } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = 5173
const reportPort = 5174

it.each([
  ['ui', `npx vitest --ui --open false --api.port ${uiPort} --reporter=html --outputFile=html/index.html`, uiPort],
  ['report', `npx vite preview --outDir html --strict-port --base __vitest__ --port ${reportPort}`, reportPort],
])('should load %s', async (_, command, port) => {
  await kill(port)
  const subProcess = execaCommand(command, {
    cwd: root,
    stdio: 'pipe',
  })

  subProcess.catch(e => e)
  const url = `http://localhost:${port}/__vitest__/`
  try {
    await withRetry(async () => {
      await page.goto(url)
    })
    expect(await page.textContent('.details-panel span')).not.toBe('')
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    killProcess(subProcess)
  }
}, 60_000)
