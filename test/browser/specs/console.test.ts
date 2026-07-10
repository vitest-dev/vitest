import { beforeAll, describe, expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

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
  hello: 'from dir',
}
      `.trim())
    expect(stdout).toContain(`
{
  hello: 'from dirxml',
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
    expect(stdout).toContain('hello from one')
    expect(stdout).toContain(`hello from two {
  hello: 'object',
}`)
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

test('disableConsoleIntercept', async () => {
  const result = await runBrowserTests({
    root: './fixtures/print-logs',
    project: [instances[0].browser],
    disableConsoleIntercept: true,
  })
  expect(result.stderr).toBe('')
  expect(result.stdout).not.toContain('logging to stdout')
  expect(result.stdout).not.toContain('hello from console.log')
})
