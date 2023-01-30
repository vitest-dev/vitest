import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { browserErrors, killProcess, page, withLoadUrl } from '../setup'

const root = resolve(__dirname, '../fixtures')
const uiPort = 9000
const reportPort = 9001

async function run(command: string, url: string) {
  let error: any
  const subProcess = execaCommand(command, {
    cwd: root,
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
  })

  subProcess.catch((e) => {
    error = e
  })

  const killSubProcess = () => killProcess(subProcess)
  subProcess.stdout?.on('data', (d) => {
    // eslint-disable-next-line no-console
    console.log(d.toString())
  })
  expect(error).not.toBeTruthy()
  try {
    await withLoadUrl(url)
    await page.goto(url)
  }
  catch (e) {
    await killSubProcess()
    throw e
  }

  return killSubProcess
}

it('should load ui', async () => {
  const kill = await run(
    `npx vitest --ui --open false --api.port ${uiPort} --reporter=html --outputFile=html/index.html`,
    `http://localhost:${uiPort}/__vitest__/`,
  )
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
  expect(browserErrors.length).toEqual(0)
  await kill()
}, 60_000)

it('should load report', async () => {
  const kill = await run(
    `npx vite preview --outDir html --strict-port --base __vitest__ --port ${reportPort}`,
     `http://localhost:${reportPort}/__vitest__/`,
  )
  try {
    expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    await kill()
  }
}, 60_000)
