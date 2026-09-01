import { execSync } from 'node:child_process'
import { expect, onTestFinished, test } from 'vitest'
import { instances, provider, runInlineBrowserTests } from './utils'

// walk the process tree because the provider does not expose the browser pid
function findDescendantBrowserProcesses(): number[] {
  const output = execSync('ps -eo pid=,ppid=,args=', { encoding: 'utf-8' })
  const childrenByParent = new Map<number, number[]>()
  const argsByPid = new Map<number, string>()
  for (const line of output.split('\n')) {
    const [pidRaw, ppidRaw, ...args] = line.trim().split(/\s+/)
    const pid = Number(pidRaw)
    const ppid = Number(ppidRaw)
    if (!Number.isInteger(pid) || !Number.isInteger(ppid)) {
      continue
    }
    const children = childrenByParent.get(ppid) ?? []
    children.push(pid)
    childrenByParent.set(ppid, children)
    argsByPid.set(pid, args.join(' '))
  }
  const browserPids: number[] = []
  const queue = [process.pid]
  while (queue.length) {
    const pid = queue.shift()!
    for (const child of childrenByParent.get(pid) ?? []) {
      queue.push(child)
      if (/headless[ _]shell|chromium|chrome/i.test(argsByPid.get(child) ?? '')) {
        browserPids.push(child)
      }
    }
  }
  return browserPids
}

function signalAll(pids: number[], signal: NodeJS.Signals) {
  for (const pid of pids) {
    try {
      process.kill(pid, signal)
    }
    catch {
      // the process is already gone
    }
  }
}

// SIGSTOP freezes the browser without closing its websocket, standing in for
// any browser death that leaves the socket open (vitest-dev/vitest#10791);
// requires a locally launched playwright browser and POSIX signals
test.runIf(
  provider.name === 'playwright'
  && process.platform !== 'win32'
  && !process.env.BROWSER_WS_ENDPOINT,
)('fails instead of hanging when the browser stops responding mid-run', { timeout: 60_000 }, async () => {
  process.env.VITEST_BROWSER_HEARTBEAT_INTERVAL = '1000'
  let frozenPids: number[] = []
  onTestFinished(() => {
    delete process.env.VITEST_BROWSER_HEARTBEAT_INTERVAL
    signalAll(frozenPids, 'SIGCONT')
  })

  const { ctx, fs } = await runInlineBrowserTests(
    {
      'basic.test.ts': `
        import { test } from 'vitest'

        test('first', () => {})

        test('never finishes', async () => {
          await new Promise(resolve => setTimeout(resolve, 60_000))
        })
      `,
    },
    {
      reporters: [
        {
          onTestCaseResult() {
            if (!frozenPids.length) {
              frozenPids = findDescendantBrowserProcesses()
              expect(frozenPids.length).toBeGreaterThan(0)
              signalAll(frozenPids, 'SIGSTOP')
            }
          },
          // unfreeze before `startVitest` closes the provider, so the
          // browser can answer the close message
          onTestRunEnd() {
            signalAll(frozenPids, 'SIGCONT')
          },
        },
      ],
      browser: {
        instances: [instances[0]],
      },
    },
  )

  const unhandledErrors = ctx!.state.getUnhandledErrors() as Error[]
  const messages = unhandledErrors.map((error) => {
    const cause = error.cause as Error | undefined
    return cause ? `${error.message} ${cause.message}` : error.message
  })
  expect(messages).toContainEqual(
    `Failed to run the test ${fs.resolveFile('basic.test.ts')}. `
    + `[vitest] The browser orchestrator did not respond to a heartbeat ping for 2000ms. `
    + `The browser process might be frozen or killed. Closing the connection.`,
  )
})

test('warns when VITEST_BROWSER_HEARTBEAT_INTERVAL is not a number and uses the default', async () => {
  process.env.VITEST_BROWSER_HEARTBEAT_INTERVAL = 'not-a-number'
  onTestFinished(() => {
    delete process.env.VITEST_BROWSER_HEARTBEAT_INTERVAL
  })

  const { ctx, stderr } = await runInlineBrowserTests(
    {
      'basic.test.ts': `
        import { test } from 'vitest'

        test('works', () => {})
      `,
    },
    {
      browser: {
        instances: [instances[0]],
      },
    },
  )

  expect(stderr).toContain(
    'VITEST_BROWSER_HEARTBEAT_INTERVAL is expected to be a number, received "not-a-number". '
    + 'Using the default interval of 15000ms instead.',
  )
  expect(ctx!.state.getUnhandledErrors()).toEqual([])
})
