import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { x } from 'tinyexec'
import { expect, test } from 'vitest'
import { Cli } from '../../test-utils/cli'
import { provider } from '../settings'
import { runBrowserTests } from './utils'

test.runIf(provider.name === 'playwright')('[playwright] runs in connect mode', async ({ onTestFinished }) => {
  const cliPath = fileURLToPath(new URL('./cli.js', import.meta.resolve('@playwright/test')))
  const subprocess = x(process.execPath, [cliPath, 'run-server', '--port', '9898']).process
  const cli = new Cli({
    stdin: subprocess.stdin,
    stdout: subprocess.stdout,
    stderr: subprocess.stderr,
  })
  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))
  subprocess.on('exit', () => setDone())
  onTestFinished(async () => {
    subprocess.kill('SIGILL')
    await isDone
  })

  await cli.waitForStdout('Listening on ws://localhost:9898')

  const result = await runBrowserTests({
    root: './fixtures/playwright-connect',
    browser: {
      instances: [
        {
          browser: 'chromium',
          name: 'chromium',
          provider: playwright({
            connectOptions: {
              wsEndpoint: 'ws://localhost:9898',
            },
            launchOptions: {
              args: [`--user-agent=VitestLaunchOptionsTester`],
            },
          }),
        },
      ],
    },
  }, ['basic.test.js'])

  expect(result.stderr).toMatchInlineSnapshot(`""`)
  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "[playwright] Run basic test in browser via connect mode": "passed",
        "[playwright] Run browser-only test in browser via connect mode": "passed",
        "[playwright] applies launch options from connect header": "passed",
      },
    }
  `)
})
