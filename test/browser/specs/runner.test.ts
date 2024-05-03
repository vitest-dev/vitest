import { beforeAll, describe, expect, onTestFailed, test } from 'vitest'
import { runBrowserTests } from './utils'

describe.each([
  ['non parallel', false],
  ['parallel', true],
])('[%s] running browser tests', async (description, fileParallelism) => {
  let stderr: string
  let stdout: string
  let browserResultJson: any
  let passedTests: any[]
  let failedTests: any[]

  beforeAll(async () => {
    ({
      stderr,
      stdout,
      browserResultJson,
      passedTests,
      failedTests,
    } = await runBrowserTests({
      browser: {
        fileParallelism,
      },
    }))
  })

  test(`[${description}] tests are actually running`, () => {
    onTestFailed(() => {
      console.error(stderr)
    })

    expect(browserResultJson.testResults).toHaveLength(15)
    expect(passedTests).toHaveLength(13)
    expect(failedTests).toHaveLength(2)

    expect(stderr).not.toContain('has been externalized for browser compatibility')
    expect(stderr).not.toContain('Unhandled Error')
  })

  test(`[${description}] correctly prints error`, () => {
    expect(stderr).toContain('expected 1 to be 2')
    expect(stderr).toMatch(/- 2\s+\+ 1/)
    expect(stderr).toContain('Expected to be')
    expect(stderr).toContain('But got')
  })

  test(`[${description}] logs are redirected to stdout`, () => {
    expect(stdout).toContain('stdout | test/logs.test.ts > logging to stdout')
    expect(stdout).toContain('hello from console.log')
    expect(stdout).toContain('hello from console.info')
    expect(stdout).toContain('hello from console.debug')
    expect(stdout).toContain('{ hello: \'from dir\' }')
    expect(stdout).toContain('{ hello: \'from dirxml\' }')
    // safari logs the stack files with @https://...
    expect(stdout).toMatch(/hello from console.trace\s+(\w+|@)/)
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

  test(`[${description}] logs are redirected to stderr`, () => {
    expect(stderr).toContain('stderr | test/logs.test.ts > logging to stderr')
    expect(stderr).toContain('hello from console.error')
    expect(stderr).toContain('hello from console.warn')
    expect(stderr).toContain('Timer "invalid timeLog" does not exist')
    expect(stderr).toContain('Timer "invalid timeEnd" does not exist')
  })

  test(`[${description}] stack trace points to correct file in every browser`, () => {
    // dependeing on the browser it references either `.toBe()` or `expect()`
    expect(stderr).toMatch(/test\/failing.test.ts:4:(12|17)/)
  })

  test(`[${description}] popup apis should log a warning`, () => {
    expect(stderr).toContain('Vitest encountered a `alert("test")`')
    expect(stderr).toContain('Vitest encountered a `confirm("test")`')
    expect(stderr).toContain('Vitest encountered a `prompt("test")`')
  })

  test(`[${description}] snapshot inaccessible file debuggability`, () => {
    expect(stderr).toContain('Access denied to "/inaccesible/path".')
  })
})
