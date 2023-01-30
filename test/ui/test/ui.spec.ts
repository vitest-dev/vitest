import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { execaCommand } from 'execa'
import { preview } from 'vite'
import { browserErrors, killProcess, page, withLoadUrl } from '../setup'

const root = resolve(__dirname, '../fixtures')
const port = 9000

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
    `npx vitest --ui --open false --api.port ${port} --reporter=html --outputFile=html/index.html`,
    `http://localhost:${port}/__vitest__/`,
  )
  expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
  expect(browserErrors.length).toEqual(0)
  await kill()
}, 60_000)

it('should load report', async () => {
  const server = await preview({
    base: '/__vitest__/',
    root,
    preview: {
      strictPort: true,
      port,
      open: false,
    },
    build: {
      outDir: 'html',
    },
  })
  server.printUrls()
  await withLoadUrl(`http://localhost:${port}/__vitest__/`)
  try {
    expect((await (await page.$('#app'))?.innerHTML() || '').length).not.toBe(0)
    expect(browserErrors.length).toEqual(0)
  }
  finally {
    await new Promise<void>((resolve, reject) => {
      server.httpServer.close(error => error ? reject(error) : resolve())
    })
  }
}, 60_000)
