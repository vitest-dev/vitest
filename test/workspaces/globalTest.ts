import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import type { GlobalSetupContext } from 'vitest/node'

declare module 'vitest' {
  interface ProvidedContext {
    globalSetup: boolean
    globalSetupOverriden: boolean
    invalidValue: unknown
  }
}

export function setup({ provide }: GlobalSetupContext) {
  provide('globalSetup', true)
  provide('globalSetupOverriden', false)
  try {
    provide('invalidValue', () => {})
    throw new Error('Should throw')
  }
  catch (err: any) {
    assert.equal(err.message, 'Cannot provide "invalidValue" because it\'s not serializable.')
    assert.match(err.cause.message, /could not be cloned/)
    assert.equal(err.cause.name, 'DataCloneError')
  }
}

export async function teardown() {
  const results = JSON.parse(await readFile('./results.json', 'utf-8'))

  try {
    assert.ok(results.success)
    assert.equal(results.numTotalTestSuites, 11)
    assert.equal(results.numTotalTests, 12)
    assert.equal(results.numPassedTests, 12)

    const shared = results.testResults.filter((r: any) => r.name.includes('space_shared/test.spec.ts'))

    assert.equal(shared.length, 2)
  }
  catch (err) {
    console.error(err)
    process.exit(1)
  }
}
