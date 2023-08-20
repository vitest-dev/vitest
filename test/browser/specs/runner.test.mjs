import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { execa } from 'execa'

const browser = process.env.BROWSER || (process.env.PROVIDER === 'playwright' ? 'chromium' : 'chrome')

const { stderr, stdout } = await execa('npx', ['vitest', '--run', `--browser.name=${browser}`, '--browser.headless'], {
  env: {
    ...process.env,
    CI: 'true',
    NO_COLOR: 'true',
  },
  reject: false,
})

const browserResult = await readFile('./browser.json', 'utf-8')
const browserResultJson = JSON.parse(browserResult)

const getPassed = results => results.filter(result => result.status === 'passed')
const getFailed = results => results.filter(result => result.status === 'failed')

const passedTests = getPassed(browserResultJson.testResults)
const failedTests = getFailed(browserResultJson.testResults)

await test('tests are actually running', async () => {
  assert.ok(browserResultJson.testResults.length === 9, 'Not all the tests have been run')
  assert.ok(passedTests.length === 8, 'Some tests failed')
  assert.ok(failedTests.length === 1, 'Some tests have passed but should fail')

  assert.doesNotMatch(stderr, /Unhandled Error/, 'doesn\'t have any unhandled errors')
})

await test('correctly prints error', () => {
  assert.match(stderr, /expected 1 to be 2/, 'prints failing error')
  assert.match(stderr, /- 2\s+\+ 1/, 'prints failing diff')
})

await test('logs are redirected to stdout', async () => {
  assert.match(stdout, /stdout | test\/logs.test.ts > logging to stdout/)
  assert.match(stdout, /hello from console.log/, 'prints console.log')
  assert.match(stdout, /hello from console.info/, 'prints console.info')
  assert.match(stdout, /hello from console.debug/, 'prints console.debug')
  assert.match(stdout, /{ hello: 'from dir' }/, 'prints console.dir')
  assert.match(stdout, /{ hello: 'from dirxml' }/, 'prints console.dixml')
  // safari logs the stack files with @https://...
  assert.match(stdout, /hello from console.trace\s+(\w+|@)/, 'prints console.trace')
  assert.match(stdout, /dom <div \/>/, 'prints dom')
  assert.match(stdout, /default: 1/, 'prints first default count')
  assert.match(stdout, /default: 2/, 'prints second default count')
  assert.match(stdout, /default: 3/, 'prints third default count')
  assert.match(stdout, /count: 1/, 'prints first custom count')
  assert.match(stdout, /count: 2/, 'prints second custom count')
  assert.match(stdout, /count: 3/, 'prints third custom count')
  assert.match(stdout, /default: [\d.]+ ms/, 'prints default time')
  assert.match(stdout, /time: [\d.]+ ms/, 'prints custom time')
})

await test('logs are redirected to stderr', async () => {
  assert.match(stderr, /stderr | test\/logs.test.ts > logging to stderr/)
  assert.match(stderr, /hello from console.error/, 'prints console.log')
  assert.match(stderr, /hello from console.warn/, 'prints console.info')
  assert.match(stderr, /Timer "invalid timeLog" does not exist/, 'prints errored timeLog')
  assert.match(stderr, /Timer "invalid timeEnd" does not exist/, 'prints errored timeEnd')
})

await test('stack trace points to correct file in every browser', () => {
  // dependeing on the browser it references either `.toBe()` or `expect()`
  assert.match(stderr, /test\/failing.test.ts:4:(12|17)/, 'prints stack trace')
})

await test('popup apis should log a warning', () => {
  assert.ok(stderr.includes('Vitest encountered a \`alert\("test"\)\`'), 'prints warning for alert')
  assert.ok(stderr.includes('Vitest encountered a \`confirm\("test"\)\`'), 'prints warning for confirm')
  assert.ok(stderr.includes('Vitest encountered a \`prompt\("test"\)\`'), 'prints warning for prompt')
})
