import { expect, test } from 'vitest'
import { createFile, editFile, resolvePath, runVitestCli } from '../../test-utils'

// Test fixture for changed flag functionality
const testFixturePath = './fixtures/list-changed'

test('list command with --changed flag shows only changed tests', async () => {
  // Create a test file that will be modified
  const sourceFile = resolvePath(import.meta.url, `${testFixturePath}/src/calculator.ts`)
  createFile(sourceFile, `
export function add(a: number, b: number): number {
  return a + b
}

export function subtract(a: number, b: number): number {
  return a - b
}
`)

  // Create a test file that imports from the source
  const testFile = resolvePath(import.meta.url, `${testFixturePath}/calculator.test.ts`)
  createFile(testFile, `
import { describe, it, expect } from 'vitest'
import { add, subtract } from './src/calculator'

describe('calculator', () => {
  it('should add two numbers', () => {
    expect(add(1, 2)).toBe(3)
  })

  it('should subtract two numbers', () => {
    expect(subtract(5, 3)).toBe(2)
  })
})
`)

  // Create another test file that won't be affected by changes
  const unrelatedTestFile = resolvePath(import.meta.url, `${testFixturePath}/unrelated.test.ts`)
  createFile(unrelatedTestFile, `
import { describe, it, expect } from 'vitest'

describe('unrelated', () => {
  it('should pass', () => {
    expect(true).toBe(true)
  })
})
`)

  // First, run list without --changed to see all tests
  const { stdout: allTests, exitCode: allTestsExitCode } = await runVitestCli(
    'list',
    '-r=./fixtures/list-changed',
  )
  expect(allTestsExitCode).toBe(0)
  expect(allTests).toContain('calculator.test.ts')
  expect(allTests).toContain('unrelated.test.ts')

  // Now modify the source file to trigger --changed behavior
  editFile(sourceFile, content => content.replace('return a + b', 'return a + b // modified'))

  // Run list with --changed flag
  const { stdout: changedTests, exitCode: changedTestsExitCode } = await runVitestCli(
    'list',
    '-r=./fixtures/list-changed',
    '--changed',
  )
  expect(changedTestsExitCode).toBe(0)

  // Should only show tests related to changed files
  expect(changedTests).toContain('calculator.test.ts')
  expect(changedTests).not.toContain('unrelated.test.ts')
})

test('list command with --changed flag and --filesOnly shows only changed test files', async () => {
  // Create a test file that will be modified
  const sourceFile = resolvePath(import.meta.url, `${testFixturePath}/src/utils.ts`)
  createFile(sourceFile, `
export function formatName(name: string): string {
  return name.toUpperCase()
}
`)

  // Create a test file that imports from the source
  const testFile = resolvePath(import.meta.url, `${testFixturePath}/utils.test.ts`)
  createFile(testFile, `
import { describe, it, expect } from 'vitest'
import { formatName } from './src/utils'

describe('utils', () => {
  it('should format name to uppercase', () => {
    expect(formatName('john')).toBe('JOHN')
  })
})
`)

  // Create another test file that won't be affected
  const unrelatedTestFile = resolvePath(import.meta.url, `${testFixturePath}/another-unrelated.test.ts`)
  createFile(unrelatedTestFile, `
import { describe, it, expect } from 'vitest'

describe('another unrelated', () => {
  it('should also pass', () => {
    expect(1 + 1).toBe(2)
  })
})
`)

  // Modify the source file
  editFile(sourceFile, content => content.replace('toUpperCase()', 'toUpperCase() // modified'))

  // Run list with --changed and --filesOnly flags
  const { stdout: changedFiles, exitCode: changedFilesExitCode } = await runVitestCli(
    'list',
    '-r=./fixtures/list-changed',
    '--changed',
    '--filesOnly',
  )
  expect(changedFilesExitCode).toBe(0)

  // Should only show test files related to changed files
  expect(changedFiles).toContain('utils.test.ts')
  expect(changedFiles).not.toContain('another-unrelated.test.ts')
})

test('list command with --changed flag and --json outputs changed tests in JSON format', async () => {
  // Create a test file that will be modified
  const sourceFile = resolvePath(import.meta.url, `${testFixturePath}/src/helper.ts`)
  createFile(sourceFile, `
export function greet(name: string): string {
  return \`Hello, \${name}!\`
}
`)

  // Create a test file that imports from the source
  const testFile = resolvePath(import.meta.url, `${testFixturePath}/helper.test.ts`)
  createFile(testFile, `
import { describe, it, expect } from 'vitest'
import { greet } from './src/helper'

describe('helper', () => {
  it('should greet with name', () => {
    expect(greet('World')).toBe('Hello, World!')
  })
})
`)

  // Modify the source file
  editFile(sourceFile, content => content.replace('Hello', 'Hi'))

  // Run list with --changed and --json flags
  const { stdout: changedJson, exitCode: changedJsonExitCode } = await runVitestCli(
    'list',
    '-r=./fixtures/list-changed',
    '--changed',
    '--json',
  )
  expect(changedJsonExitCode).toBe(0)

  // Parse JSON output
  const jsonOutput = JSON.parse(changedJson)
  expect(Array.isArray(jsonOutput)).toBe(true)

  // Should contain test related to changed file
  const helperTest = jsonOutput.find((test: any) => test.file?.includes('helper.test.ts'))
  expect(helperTest).toBeDefined()
  expect(helperTest.name).toBe('helper > should greet with name')
})

test('list command with --changed flag when no changes exist', async () => {
  // Create test files without making any changes
  const testFile = resolvePath(import.meta.url, `${testFixturePath}/no-changes.test.ts`)
  createFile(testFile, `
import { describe, it, expect } from 'vitest'

describe('no changes', () => {
  it('should pass', () => {
    expect(true).toBe(true)
  })
})
`)

  // Run list with --changed flag when no changes exist
  const { stdout: noChangesOutput, exitCode: noChangesExitCode } = await runVitestCli(
    'list',
    '-r=./fixtures/list-changed',
    '--changed',
  )

  // Should show no tests when no changes exist
  expect(noChangesExitCode).toBe(0)
  expect(noChangesOutput.trim()).toBe('')
})
