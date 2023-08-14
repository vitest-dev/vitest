import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export async function teardown() {
  const results = JSON.parse(await readFile('./results.json', 'utf-8'))

  try {
    assert.ok(results.success)
    assert.equal(results.numTotalTestSuites, 3)
    assert.equal(results.numTotalTests, 3)
    assert.equal(results.numPassedTests, 3)
  }
  catch (err) {
    console.error(err)
    process.exit(1)
  }
}
