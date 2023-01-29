import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import kill from 'kill-port'
import { execaCommand } from 'execa'
import { browserErrors, killProcess, page, untilUpdated, withRetry } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = 5173
const reportPort = 5174

async function run(command: string, port: number) {
  await kill(port)
  const subProcess = execaCommand(command, {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    stdio: 'pipe',
  })

  const killSubProcess = () => killProcess(subProcess)

  subProcess.catch(e => e)
  const url = `http://localhost:${port}/__vitest__/`
  try {
    await withRetry(async () => {
      await page.goto(url)
    })
  }
  catch (e) {
    await killSubProcess()
    throw e
  }

  return killSubProcess
}

it('should load ui', async () => {
  const kill = await run(`npx vitest --ui --open false --api.port ${uiPort} --reporter=html --outputFile=html/index.html`, uiPort)
  expect(browserErrors.length).toEqual(0)
  await kill()
}, 60_000)

it('should load ui', async () => {
  const kill = await run(`npx vite preview --outDir html --strict-port --base __vitest__ --port ${reportPort}`, reportPort)
  try {
    await untilUpdated(async () => `${(await page.$$('.details-panel span')).length}`, '2')
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    await kill()
  }
}, 60_000)
