import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'

export async function teardown() {
  const results = JSON.parse(await readFile('./results.json', 'utf-8'))

  try {
    assert.ok(results.success)
    assert.equal(results.numTotalTestSuites, 7)
    assert.equal(results.numTotalTests, 8)
    assert.equal(results.numPassedTests, 8)

    const shared = results.testResults.filter((r: any) => r.name.includes('space_shared/test.spec.ts'))

    assert.equal(shared.length, 2)
  }
  catch (err) {
    console.error(err)
    process.exit(1)
  }
}
