import type { GlobalSetupContext } from 'vitest/node'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

declare module 'vitest' {
  interface ProvidedContext {
    globalSetup: boolean
    globalSetupOverridden: boolean
    invalidValue: unknown
    projectConfigValue: boolean
    globalConfigValue: boolean

    providedConfigValue: string
  }
}

export function setup({ provide }: GlobalSetupContext) {
  provide('globalSetup', true)
  provide('globalSetupOverridden', false)
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

let teardownCalled = false

export async function teardown() {
  teardownCalled = true
  const results = JSON.parse(await readFile('./results.json', 'utf-8'))

  try {
    assert.ok(results.success)
    assert.equal(results.numTotalTestSuites, 28)
    assert.equal(results.numTotalTests, 33)
    assert.equal(results.numPassedTests, 33)
    assert.ok(results.coverageMap)

    const shared = results.testResults.filter((r: any) => r.name.includes('space_shared/test.spec.ts'))

    assert.equal(shared.length, 2)
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
