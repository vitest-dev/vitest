import { editFile, resolvePath, runVitestCli } from '#test-utils'
import { test as baseTest, expect } from 'vitest'

// ecosystem-ci updated package.json and make this test fail
const test = baseTest.skipIf(!!process.env.ECOSYSTEM_CI)

test('list command with --changed flag shows only changed tests', async () => {
  const sourceFile = resolvePath(import.meta.url, '../fixtures/git-changed/related/src/sourceA.ts')

  // First, run list without --changed to see all tests
  const { stdout: allTests } = await runVitestCli('list', '-r=./fixtures/git-changed/related')
  expect(allTests).toContain('related.test.ts')
  expect(allTests).toContain('not-related.test.ts')

  // Now modify the source file to trigger --changed behavior
  editFile(sourceFile, content => `${content}\n// modified for test`)

  // Run list with --changed flag
  const { stdout: changedTests } = await runVitestCli('list', '-r=./fixtures/git-changed/related', '--changed')
  expect(changedTests).toContain('related.test.ts')
  expect(changedTests).not.toContain('not-related.test.ts')
})

test('list command with --changed flag and --filesOnly shows only changed test files', async () => {
  const sourceFile = resolvePath(import.meta.url, '../fixtures/git-changed/related/src/sourceA.ts')
  editFile(sourceFile, content => `${content}\n// modified for filesOnly test`)

  const { stdout: changedFiles } = await runVitestCli('list', '-r=./fixtures/git-changed/related', '--changed', '--filesOnly')
  expect(changedFiles).toContain('related.test.ts')
  expect(changedFiles).not.toContain('not-related.test.ts')
})

test('list command with --changed flag and --json outputs changed tests in JSON format', async () => {
  const sourceFile = resolvePath(import.meta.url, '../fixtures/git-changed/related/src/sourceA.ts')
  editFile(sourceFile, content => `${content}\n// modified for json test`)

  const { stdout: changedJson } = await runVitestCli('list', '-r=./fixtures/git-changed/related', '--changed', '--json')
  const jsonOutput = JSON.parse(changedJson)
  expect(Array.isArray(jsonOutput)).toBe(true)
  const relatedTest = jsonOutput.find((test: any) => test.file?.includes('related.test.ts'))
  expect(relatedTest).toBeDefined()
})

test('list command with --changed flag when no changes exist should show no tests', async () => {
  const { stdout: noChangesOutput } = await runVitestCli('list', '-r=./fixtures/git-changed/related', '--changed')
  expect(noChangesOutput.trim()).toBe('')
})
