import { readFile } from 'node:fs/promises'
import { beforeAll, describe, expect, onTestFailed, test } from 'vitest'
import { browser, provider, runBrowserTests } from './utils'

describe('running browser tests', async () => {
  let stderr: string
  let stdout: string
  let browserResultJson: any
  let passedTests: any[]
  let failedTests: any[]

  beforeAll(() => {
    const id = setInterval(() => console.log('[debug]', new Date().toISOString()), 2000)
    return () => clearInterval(id)
  })

  beforeAll(async () => {
    ({
      stderr,
      stdout,
    } = await runBrowserTests(undefined, undefined, undefined, { std: 'inherit' }))

    const browserResult = await readFile('./browser.json', 'utf-8')
    browserResultJson = JSON.parse(browserResult)
    const getPassed = results => results.filter(result => result.status === 'passed' && !result.mesage)
    const getFailed = results => results.filter(result => result.status === 'failed')
    passedTests = getPassed(browserResultJson.testResults)
    failedTests = getFailed(browserResultJson.testResults)
  })

  test('tests are actually running', () => {
    onTestFailed(() => {
      console.error(stderr)
    })

    expect(browserResultJson.testResults).toHaveLength(19)
    expect(passedTests).toHaveLength(17)
    expect(failedTests).toHaveLength(2)

    expect(stderr).not.toContain('optimized dependencies changed')
    expect(stderr).not.toContain('has been externalized for browser compatibility')
    expect(stderr).not.toContain('Unhandled Error')
  })

  test('runs in-source tests', () => {
    expect(stdout).toContain('src/actions.ts')
    const actionsTest = passedTests.find(t => t.name.includes('/actions.ts'))
    expect(actionsTest).toBeDefined()
    expect(actionsTest.assertionResults).toHaveLength(1)
  })

  test('correctly prints error', () => {
    expect(stderr).toContain('expected 1 to be 2')
    expect(stderr).toMatch(/- 2\s+\+ 1/)
    expect(stderr).toContain('Expected to be')
    expect(stderr).toContain('But got')
    expect(stderr).toContain('Failure screenshot')
    expect(stderr).toContain('__screenshots__/failing')
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

  test.runIf(browser !== 'webkit')(`logs have stack traces in non-safari`, () => {
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
  })

  test.runIf(browser === 'webkit')(`logs have stack traces in safari`, () => {
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
  })

  test(`stack trace points to correct file in every browser`, () => {
    // dependeing on the browser it references either `.toBe()` or `expect()`
    expect(stderr).toMatch(/test\/failing.test.ts:10:(12|17)/)

    // column is 18 in safari, 8 in others
    expect(stderr).toMatch(/throwError src\/error.ts:8:(18|8)/)

    expect(stderr).toContain('The call was not awaited. This method is asynchronous and must be awaited; otherwise, the call will not start to avoid unhandled rejections.')
    expect(stderr).toMatch(/test\/failing.test.ts:18:(27|36)/)
    expect(stderr).toMatch(/test\/failing.test.ts:19:(27|33)/)
    expect(stderr).toMatch(/test\/failing.test.ts:20:(27|39)/)
  })

  test('popup apis should log a warning', () => {
    expect(stderr).toContain('Vitest encountered a `alert("test")`')
    expect(stderr).toContain('Vitest encountered a `confirm("test")`')
    expect(stderr).toContain('Vitest encountered a `prompt("test")`')
  })

  test('snapshot inaccessible file debuggability', () => {
    expect(stderr).toContain('Access denied to "/inaccesible/path".')
  })
})

test('user-event', async () => {
  const { ctx } = await runBrowserTests({
    root: './fixtures/user-event',
  })
  expect(Object.fromEntries(ctx.state.getFiles().map(f => [f.name, f.result.state]))).toMatchInlineSnapshot(`
    {
      "cleanup-retry.test.ts": "pass",
      "cleanup1.test.ts": "pass",
      "cleanup2.test.ts": "pass",
      "keyboard.test.ts": "pass",
    }
  `)
})

test('timeout', async () => {
  const { stderr } = await runBrowserTests({
    root: './fixtures/timeout',
  })
  expect(stderr).toContain('Matcher did not succeed in 500ms')
  if (provider === 'playwright') {
    expect(stderr).toContain('locator.click: Timeout 500ms exceeded.')
    expect(stderr).toContain('locator.click: Timeout 345ms exceeded.')
  }
  if (provider === 'webdriverio') {
    expect(stderr).toContain('Cannot find element with locator')
  }
})
