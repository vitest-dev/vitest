import type { Vitest } from 'vitest/node'
import type { JsonTestResults } from 'vitest/reporters'
import { readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, onTestFailed, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'
import { instances, provider, runBrowserTests } from './utils'

function noop() {}

describe('running browser tests', async () => {
  let stderr: string
  let stdout: string
  let browserResultJson: JsonTestResults
  let passedTests: any[]
  let failedTests: any[]
  let vitest: Vitest
  const events: string[] = []

  beforeAll(async () => {
    ({
      stderr,
      stdout,
      ctx: vitest,
    } = await runBrowserTests({
      allowOnly: true,
      reporters: [
        {
          onBrowserInit(project) {
            events.push(`onBrowserInit ${project.name}`)
          },
        },
        'json',
        {
          onInit: noop,
          onPathsCollected: noop,
          onCollected: noop,
          onFinished: noop,
          onTaskUpdate: noop,
          onTestRemoved: noop,
          onWatcherStart: noop,
          onWatcherRerun: noop,
          onServerRestart: noop,
          onUserConsoleLog: noop,
        },
        'default',
      ],
    }))

    const browserResult = await readFile('./browser.json', 'utf-8')
    browserResultJson = JSON.parse(browserResult)
    const getPassed = results => results.filter(result => result.status === 'passed' && !result.mesage)
    const getFailed = results => results.filter(result => result.status === 'failed')
    passedTests = getPassed(browserResultJson.testResults)
    failedTests = getFailed(browserResultJson.testResults)
  })

  test('tests are actually running', () => {
    expect(stderr).toBe('')

    const testFiles = browserResultJson.testResults.map(t => t.name)

    vitest.projects.forEach((project) => {
      // the order is non-deterministic
      expect(events).toContain(`onBrowserInit ${project.name}`)
    })

    // test files are optimized automatically
    expect(vitest.projects.map(p => p.browser?.vite.config.optimizeDeps.entries))
      .toEqual(vitest.projects.map(() => expect.arrayContaining(testFiles)))

    const testFilesCount = readdirSync('./test')
      .filter(n => n.includes('.test.'))
      .length + 1 // 1 is in-source-test

    expect(browserResultJson.testResults).toHaveLength(testFilesCount * instances.length)
    expect(passedTests).toHaveLength(browserResultJson.testResults.length)
    expect(failedTests).toHaveLength(0)
  })

  test('runs in-source tests', () => {
    expect(stdout).toContain('src/actions.ts')
    const actionsTest = passedTests.find(t => t.name.includes('/actions.ts'))
    expect(actionsTest).toBeDefined()
    expect(actionsTest.assertionResults).toHaveLength(1)
  })
})

describe('console logging tests', async () => {
  let stderr: string
  let stdout: string
  beforeAll(async () => {
    ({
      stderr,
      stdout,
    } = await runBrowserTests({
      root: './fixtures/print-logs',
    }))
  })

  test('logs are redirected to stdout', () => {
    expect(stdout).toContain('stdout | test/logs.test.ts > logging to stdout')
    expect(stdout).toContain('hello from console.log')
    expect(stdout).toContain('hello from console.info')
    expect(stdout).toContain('hello from console.debug')
    expect(stdout).toContain(`
{
  "hello": "from dir",
}
      `.trim())
    expect(stdout).toContain(`
{
  "hello": "from dirxml",
}
      `.trim())
    expect(stdout).toContain('dom <div />')
    expect(stdout).toContain('default: 1')
    expect(stdout).toContain('default: 2')
    expect(stdout).toContain('default: 3')
    expect(stdout).toContain('count: 1')
    expect(stdout).toContain('count: 2')
    expect(stdout).toContain('count: 3')
    expect(stdout).toMatch(/default: [\d.]+ ms/)
    expect(stdout).toMatch(/time: [\d.]+ ms/)
    expect(stdout).toMatch(/\[console-time-fake\]: [\d.]+ ms/)
    expect(stdout).not.toContain('[console-time-fake]: 0 ms')
  })

  test('logs are redirected to stderr', () => {
    expect(stderr).toContain('stderr | test/logs.test.ts > logging to stderr')
    expect(stderr).toContain('hello from console.error')
    expect(stderr).toContain('hello from console.warn')
    expect(stderr).toContain('Timer "invalid timeLog" does not exist')
    expect(stderr).toContain('Timer "invalid timeEnd" does not exist')
    // safari logs the stack files with @https://...
    expect(stderr).toMatch(/hello from console.trace\s+(\w+|@)/)
  })

  test(`logs have stack traces`, () => {
    expect(stdout).toMatch(`
log with a stack
 ❯ test/logs.test.ts:58:10
    `.trim())
    expect(stderr).toMatch(`
error with a stack
 ❯ test/logs.test.ts:59:10
    `.trim())
    // console.trace processes the stack trace correctly
    expect(stderr).toMatch('test/logs.test.ts:60:10')

    if (instances.some(({ browser }) => browser === 'webkit')) {
    // safari print stack trace in a different place
      expect(stdout).toMatch(`
log with a stack
 ❯ test/logs.test.ts:58:14
    `.trim())
      expect(stderr).toMatch(`
error with a stack
 ❯ test/logs.test.ts:59:16
    `.trim())
      // console.trace processes the stack trace correctly
      expect(stderr).toMatch('test/logs.test.ts:60:16')
    }
  })

  test('popup apis should log a warning', () => {
    expect(stderr).toContain('Vitest encountered a `alert("test")`')
    expect(stderr).toContain('Vitest encountered a `confirm("test")`')
    expect(stderr).toContain('Vitest encountered a `prompt("test")`')
  })
})

test(`stack trace points to correct file in every browser when failed`, async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/failing',
  })

  expect(stderr).toContain('expected 1 to be 2')
  expect(stderr).toMatch(/- 2\s+\+ 1/)
  // expect(stderr).toContain('Expected to be')
  // expect(stderr).toContain('But got')
  expect(stderr).toContain('Failure screenshot')
  expect(stderr).toContain('__screenshots__/failing')

  expect(stderr).toContain('Access denied to "/inaccesible/path".')

  // depending on the browser it references either `.toBe()` or `expect()`
  expect(stderr).toMatch(/failing.test.ts:11:(12|17)/)

  // column is 18 in safari, 8 in others
  expect(stderr).toMatch(/throwError src\/error.ts:8:(18|8)/)

  expect(stderr).toContain('The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.')
  expect(stderr).toMatch(/failing.test.ts:19:(27|36)/)
  expect(stderr).toMatch(/failing.test.ts:20:(27|33)/)
  expect(stderr).toMatch(/failing.test.ts:21:(27|39)/)

  expect(stderr).toMatch(/bundled-lib\/src\/b.js:2:(9|19)/)
  expect(stderr).toMatch(/bundled-lib\/src\/index.js:5:(16|18)/)

  // index() is called from a bundled file
  expect(stderr).toMatch(/failing.test.ts:25:(2|8)/)
})

test('user-event', async () => {
  const { stdout, stderr } = await runBrowserTests({
    root: './fixtures/user-event',
  })
  if (provider !== 'webdriverio') {
    expect(stderr).toBe('')
  }
  onTestFailed(() => console.error(stderr))
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('cleanup-retry.test.ts', browser)
    expect(stdout).toReportPassedTest('cleanup1.test.ts', browser)
    expect(stdout).toReportPassedTest('cleanup2.test.ts', browser)
    expect(stdout).toReportPassedTest('keyboard.test.ts', browser)
    expect(stdout).toReportPassedTest('clipboard.test.ts', browser)
  })
})

test('timeout settings', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/timeout',
  })
  expect(stderr).toContain('Matcher did not succeed in time.')
  if (provider === 'playwright') {
    expect(stderr).toContain('locator.click: Timeout 500ms exceeded.')
    expect(stderr).toContain('locator.click: Timeout 345ms exceeded.')
  }
  if (provider === 'webdriverio') {
    expect(stderr).toContain('Cannot find element with locator')
  }
})

test('viewport', async () => {
  const { stdout, stderr } = await runBrowserTests({
    root: './fixtures/viewport',
  })
  expect(stderr).toBe('')
  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('basic.test.ts', browser)
  })
})

test('in-source tests don\'t run when the module is imported by the test', async () => {
  const { stderr, stdout } = await runBrowserTests({}, ['mocking.test.ts'])
  expect(stderr).toBe('')

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('test/mocking.test.ts', browser)
  })

  // there is only one file with one test inside
  // if this stops working, it will report twice as much tests
  expect(stdout).toContain(`Test Files  ${instances.length} passed`)
  expect(stdout).toContain(`Tests  ${instances.length} passed`)
})

test('in-source tests run correctly when filtered', async () => {
  const { stderr, stdout } = await runBrowserTests({}, ['actions.ts'])
  expect(stderr).toBe('')

  instances.forEach(({ browser }) => {
    expect(stdout).toReportPassedTest('src/actions.ts', browser)
  })

  // there is only one file with one test inside
  expect(stdout).toContain(`Test Files  ${instances.length} passed`)
  expect(stdout).toContain(`Tests  ${instances.length} passed`)
})

test.runIf(provider === 'playwright')('timeout hooks', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/timeout-hooks',
  })

  const lines = stderr.split('\n')
  const timeoutErrorsIndexes = []
  lines.forEach((line, index) => {
    if (line.includes('TimeoutError:')) {
      timeoutErrorsIndexes.push(index)
    }
  })

  const snapshot = timeoutErrorsIndexes.map((index) => {
    return [
      lines[index - 1],
      lines[index].replace(/Timeout \d+ms exceeded/, 'Timeout <ms> exceeded'),
      lines[index + 4],
    ].join('\n')
  }).sort().join('\n\n')

  // rolldown has better source maps
  if (rolldownVersion) {
    expect(snapshot).toMatchInlineSnapshot(`
      " FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:44:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:26:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:35:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:17:45

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:7:33

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:79:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:61:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:44:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:26:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:35:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:17:45

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:7:33

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:79:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:61:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:44:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:26:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:35:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:17:45

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:7:33

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:70:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:79:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:54:47

       FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
      TimeoutError: locator.click: Timeout <ms> exceeded.
       ❯ hooks-timeout.test.ts:61:47"
    `)
  }
  else {
    expect(snapshot).toMatchInlineSnapshot(`
    " FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:44:45

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:26:45

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:35:45

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:17:45

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:7:33

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:70:47

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:79:47

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:54:47

     FAIL  |chromium| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:61:47

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:44:45

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:26:45

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:35:45

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:17:45

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:7:33

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:70:47

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:79:47

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:54:47

     FAIL  |firefox| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:61:47

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterAll
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:44:51

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > afterEach > skipped
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:26:51

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeAll
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:35:51

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > beforeEach > skipped
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:17:51

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > click on non-existing element fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:7:39

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:70:53

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFailed > fails global
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:79:53

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:54:53

     FAIL  |webkit| hooks-timeout.test.ts > timeouts are failing correctly > onTestFinished > fails global
    TimeoutError: locator.click: Timeout <ms> exceeded.
     ❯ hooks-timeout.test.ts:61:53"
  `)
  }

  // page.getByRole('code').click()
  expect(stderr).toContain('locator.click: Timeout')
  // playwright error is proxied from the server to the client and back correctly
  expect(stderr).toContain('waiting for locator(\'[data-vitest="true"]\').contentFrame().getByRole(\'code\')')
  expect(stderr).toMatch(/hooks-timeout.test.ts:7:(33|39)/)
  // await expect.element().toBeVisible()
  expect(stderr).toContain('Cannot find element with locator: getByRole(\'code\')')
  expect(stderr).toMatch(/hooks-timeout.test.ts:11:(49|61)/)
}, 120_000 * 3)
