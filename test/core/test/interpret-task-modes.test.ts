import type { File, RunMode, Suite, Test } from '@vitest/runner'
import { describe, expect, it } from 'vitest'
import { interpretTaskModes, someTasksAreOnly } from '@vitest/runner/utils'

function createFile(name: string): File {
  const file: File = {
    id: '1',
    name,
    fullName: name,
    type: 'suite',
    mode: 'queued',
    filepath: `/test/${name}`,
    tasks: [],
    meta: {},
    projectName: undefined,
    file: undefined!,
  }
  file.file = file
  return file
}

function createSuite(name: string, mode: RunMode = 'run', parent?: Suite): Suite {
  const suite: Suite = {
    id: parent ? `${parent.id}_${parent.tasks.length}` : '1_0',
    name,
    fullName: parent ? `${parent.fullName} ${name}` : name,
    type: 'suite',
    mode,
    tasks: [],
    meta: {},
    suite: parent,
    file: parent?.file || undefined!,
  }
  return suite
}

function createTest(name: string, mode: RunMode = 'run', suite?: Suite, location?: { line: number, column: number }): Test {
  const test: Test = {
    id: suite ? `${suite.id}_${suite.tasks.length}` : '1_0',
    name,
    fullName: suite ? `${suite.fullName} ${name}` : name,
    fullTestName: name,
    type: 'test',
    mode,
    meta: {},
    suite,
    file: suite?.file || undefined!,
    context: undefined!,
    timeout: 5000,
    annotations: [],
    artifacts: [],
    location,
  }
  return test
}

function addToSuite(suite: Suite, task: Suite | Test): void {
  task.suite = suite
  task.file = suite.file
  task.id = `${suite.id}_${suite.tasks.length}`
  task.fullName = `${suite.fullName} ${task.name}`
  suite.tasks.push(task)
}

function getModes(file: File): Record<string, RunMode> {
  const result: Record<string, RunMode> = {}
  function collect(suite: Suite, prefix = '') {
    for (const task of suite.tasks) {
      const key = prefix ? `${prefix} > ${task.name}` : task.name
      result[key] = task.mode
      if (task.type === 'suite') {
        collect(task, key)
      }
    }
  }
  collect(file)
  return result
}

describe('interpretTaskModes', () => {
  describe('basic mode handling', () => {
    it('should not change modes when no special conditions apply', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'run')
      const test2 = createTest('test 2', 'run')
      addToSuite(file, test1)
      addToSuite(file, test2)

      interpretTaskModes(file, undefined, undefined, false, false, true)

      expect(getModes(file)).toEqual({
        'test 1': 'run',
        'test 2': 'run',
      })
    })

    it('should propagate skip mode to nested tasks', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'skip')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'run')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, undefined, false, false, true)

      expect(getModes(file)).toEqual({
        'suite': 'skip',
        'suite > test 1': 'skip',
        'suite > test 2': 'skip',
      })
    })

    it('should propagate todo mode to nested tasks', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'todo')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'run')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, undefined, false, false, true)

      expect(getModes(file)).toEqual({
        'suite': 'todo',
        'suite > test 1': 'todo',
        'suite > test 2': 'todo',
      })
    })
  })

  describe('only mode handling', () => {
    it('should run only test.only when onlyMode is true', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'only')
      const test2 = createTest('test 2', 'run')
      addToSuite(file, test1)
      addToSuite(file, test2)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'test 1': 'run',
        'test 2': 'skip',
      })
    })

    it('should run all tests in describe.only when no test.only inside', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'only')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'run')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      const outsideTest = createTest('outside test', 'run')
      addToSuite(file, outsideTest)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'suite': 'run',
        'suite > test 1': 'run',
        'suite > test 2': 'run',
        'outside test': 'skip',
      })
    })

    it('should run only test.only inside describe.only (nested only)', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'only')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'only')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'suite': 'run',
        'suite > test 1': 'run',
        'suite > test 2': 'skip',
      })
    })

    it('should handle deeply nested only', () => {
      const file = createFile('test.ts')
      const suiteA = createSuite('a', 'run')
      addToSuite(file, suiteA)
      const suiteB = createSuite('b', 'run')
      addToSuite(suiteA, suiteB)
      const suiteC = createSuite('c', 'run')
      addToSuite(suiteB, suiteC)
      const test1 = createTest('test 1', 'only')
      addToSuite(suiteC, test1)

      const outsideTest = createTest('outside', 'run')
      addToSuite(file, outsideTest)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'a': 'run',
        'a > b': 'run',
        'a > b > c': 'run',
        'a > b > c > test 1': 'run',
        'outside': 'skip',
      })
    })

    it('should handle multiple only tests in same suite', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'only')
      const test2 = createTest('test 2', 'only')
      const test3 = createTest('test 3', 'run')
      addToSuite(file, test1)
      addToSuite(file, test2)
      addToSuite(file, test3)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'test 1': 'run',
        'test 2': 'run',
        'test 3': 'skip',
      })
    })

    it('should handle only in nested suite with sibling suite', () => {
      const file = createFile('test.ts')
      const suiteA = createSuite('a', 'run')
      addToSuite(file, suiteA)
      const suiteB = createSuite('b', 'only')
      addToSuite(suiteA, suiteB)
      const test1 = createTest('test 1', 'run')
      addToSuite(suiteB, test1)

      const suiteC = createSuite('c', 'run')
      addToSuite(suiteA, suiteC)
      const test2 = createTest('test 2', 'run')
      addToSuite(suiteC, test2)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'a': 'run',
        'a > b': 'run',
        'a > b > test 1': 'run',
        'a > c': 'skip',
        'a > c > test 2': 'skip',
      })
    })
  })

  describe('namePattern filtering', () => {
    it('should skip tests that do not match namePattern', () => {
      const file = createFile('test.ts')
      const test1 = createTest('should work', 'run')
      const test2 = createTest('other test', 'run')
      addToSuite(file, test1)
      addToSuite(file, test2)

      interpretTaskModes(file, /should/, undefined, false, false, true)

      expect(getModes(file)).toEqual({
        'should work': 'run',
        'other test': 'skip',
      })
    })

    it('should match full test name including suite', () => {
      const file = createFile('test.ts')
      const suite = createSuite('my suite', 'run')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'run')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, /my suite test 1/, undefined, false, false, true)

      expect(getModes(file)).toEqual({
        'my suite': 'run',
        'my suite > test 1': 'run',
        'my suite > test 2': 'skip',
      })
    })

    it('should mark suite as skip if all tests are skipped by pattern', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'run')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'run')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, /nomatch/, undefined, false, false, true)

      expect(getModes(file)).toEqual({
        'suite': 'skip',
        'suite > test 1': 'skip',
        'suite > test 2': 'skip',
      })
    })
  })

  describe('testLocations filtering', () => {
    it('should run only tests at specified locations', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'run', undefined, { line: 5, column: 1 })
      const test2 = createTest('test 2', 'run', undefined, { line: 10, column: 1 })
      addToSuite(file, test1)
      addToSuite(file, test2)

      interpretTaskModes(file, undefined, [5], false, false, true)

      expect(getModes(file)).toEqual({
        'test 1': 'run',
        'test 2': 'skip',
      })
    })

    it('should run multiple tests at specified locations', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'run', undefined, { line: 5, column: 1 })
      const test2 = createTest('test 2', 'run', undefined, { line: 10, column: 1 })
      const test3 = createTest('test 3', 'run', undefined, { line: 15, column: 1 })
      addToSuite(file, test1)
      addToSuite(file, test2)
      addToSuite(file, test3)

      interpretTaskModes(file, undefined, [5, 15], false, false, true)

      expect(getModes(file)).toEqual({
        'test 1': 'run',
        'test 2': 'skip',
        'test 3': 'run',
      })
    })

    it('should run all tests in suite when suite location matches', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'run')
      suite.location = { line: 3, column: 1 }
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'run', undefined, { line: 5, column: 1 })
      const test2 = createTest('test 2', 'run', undefined, { line: 10, column: 1 })
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, [3], false, false, true)

      expect(getModes(file)).toEqual({
        'suite': 'run',
        'suite > test 1': 'run',
        'suite > test 2': 'run',
      })
    })

    it('should add error for non-matching locations', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'run', undefined, { line: 5, column: 1 })
      addToSuite(file, test1)

      interpretTaskModes(file, undefined, [99], false, false, true)

      expect(file.result?.errors).toBeDefined()
      expect(file.result?.errors?.[0]?.message).toContain('line 99')
    })

    it('should add error for multiple non-matching locations', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'run', undefined, { line: 5, column: 1 })
      addToSuite(file, test1)

      interpretTaskModes(file, undefined, [98, 99], false, false, true)

      expect(file.result?.errors).toBeDefined()
      expect(file.result?.errors?.[0]?.message).toContain('lines 98, 99')
    })
  })

  describe('allowOnly handling', () => {
    it('should fail test with error when allowOnly is false', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'only')
      addToSuite(file, test1)

      interpretTaskModes(file, undefined, undefined, true, false, false)

      expect(test1.result?.state).toBe('fail')
      expect(test1.result?.errors?.[0]?.message).toContain('Unexpected .only modifier')
    })

    it('should not fail test with error when allowOnly is true', () => {
      const file = createFile('test.ts')
      const test1 = createTest('test 1', 'only')
      addToSuite(file, test1)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(test1.result).toBeUndefined()
    })
  })

  describe('suite skip when all children skip', () => {
    it('should mark suite as skip when all children are skipped', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'run')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'skip')
      const test2 = createTest('test 2', 'skip')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, undefined, false, false, true)

      expect(suite.mode).toBe('skip')
    })

    it('should not mark suite as skip when at least one child runs', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'run')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'skip')
      const test2 = createTest('test 2', 'run')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, undefined, false, false, true)

      expect(suite.mode).toBe('run')
    })

    it('should mark queued suite as skip when all children skip', () => {
      const file = createFile('test.ts')
      const suite = createSuite('suite', 'queued')
      addToSuite(file, suite)
      const test1 = createTest('test 1', 'skip')
      const test2 = createTest('test 2', 'skip')
      addToSuite(suite, test1)
      addToSuite(suite, test2)

      interpretTaskModes(file, undefined, undefined, false, false, true)

      expect(suite.mode).toBe('skip')
    })
  })

  describe('complex scenarios', () => {
    it('should handle combination of only and namePattern', () => {
      const file = createFile('test.ts')
      const test1 = createTest('should work', 'only')
      const test2 = createTest('should also work', 'only')
      const test3 = createTest('other test', 'run')
      addToSuite(file, test1)
      addToSuite(file, test2)
      addToSuite(file, test3)

      interpretTaskModes(file, /should work$/, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'should work': 'run',
        'should also work': 'skip',
        'other test': 'skip',
      })
    })

    it('should handle deeply nested suites with mixed modes', () => {
      const file = createFile('test.ts')

      // Create: describe > describe.only > test.only, test
      const suiteA = createSuite('a', 'run')
      addToSuite(file, suiteA)

      const suiteB = createSuite('b', 'only')
      addToSuite(suiteA, suiteB)

      const test1 = createTest('test 1', 'only')
      const test2 = createTest('test 2', 'run')
      addToSuite(suiteB, test1)
      addToSuite(suiteB, test2)

      // Add another test outside
      const outsideTest = createTest('outside', 'run')
      addToSuite(file, outsideTest)

      interpretTaskModes(file, undefined, undefined, true, false, true)

      expect(getModes(file)).toEqual({
        'a': 'run',
        'a > b': 'run',
        'a > b > test 1': 'run',
        'a > b > test 2': 'skip',
        'outside': 'skip',
      })
    })
  })
})

describe('someTasksAreOnly', () => {
  it('should return false for empty suite', () => {
    const file = createFile('test.ts')
    expect(someTasksAreOnly(file)).toBe(false)
  })

  it('should return false when no only tasks', () => {
    const file = createFile('test.ts')
    const test1 = createTest('test 1', 'run')
    addToSuite(file, test1)
    expect(someTasksAreOnly(file)).toBe(false)
  })

  it('should return true when test has only mode', () => {
    const file = createFile('test.ts')
    const test1 = createTest('test 1', 'only')
    addToSuite(file, test1)
    expect(someTasksAreOnly(file)).toBe(true)
  })

  it('should return true when nested test has only mode', () => {
    const file = createFile('test.ts')
    const suite = createSuite('suite', 'run')
    addToSuite(file, suite)
    const test1 = createTest('test 1', 'only')
    addToSuite(suite, test1)
    expect(someTasksAreOnly(file)).toBe(true)
  })

  it('should return true when suite has only mode', () => {
    const file = createFile('test.ts')
    const suite = createSuite('suite', 'only')
    addToSuite(file, suite)
    expect(someTasksAreOnly(file)).toBe(true)
  })
})
