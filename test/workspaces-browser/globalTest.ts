import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

let teardownCalled = false

export async function teardown() {
  teardownCalled = true
  const results = JSON.parse(await readFile('./results.json', 'utf-8'))

  try {
    assert.ok(results.success)
    assert.equal(results.numTotalTestSuites, 4)
    assert.equal(results.numTotalTests, 5)
    assert.equal(results.numPassedTests, 5)
  }
  catch (err) {
    console.error(err)
    // eslint-disable-next-line no-console
    console.dir(results, { depth: null })
    process.exit(1)
  }
}

process.on('beforeExit', () => {
  if (!teardownCalled) {
    console.error('teardown was not called')
    process.exitCode = 1
  }
})
