import assert from 'node:assert'
import test from 'node:test'
import runVitest from './run-vitest.mjs'

const {
  stderr,
  browserResultJson,
  passedTests,
  failedTests,
} = await runVitest(['--config', 'vitest.config-basepath.mts'])

await test('tests run in presence of config.base', async () => {
  assert.ok(browserResultJson.testResults.length === 8, 'Not all the tests have been run')
  assert.ok(passedTests.length === 7, 'Some tests failed')
  assert.ok(failedTests.length === 1, 'Some tests have passed but should fail')

  assert.doesNotMatch(stderr, /Unhandled Error/, 'doesn\'t have any unhandled errors')
})
