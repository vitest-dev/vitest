import { beforeEach, describe, expect, test } from 'vitest'

describe('TestOptions meta property functionality', { meta: { suiteLevel: 'test-suite', priority: 'medium' } }, () => {
  let beforeEachMeta: Record<string, unknown>

  beforeEach(({ task }) => {
    beforeEachMeta = { ...task.meta }
  })

  test('should merge suite and test meta properties', { meta: { testLevel: 'individual-test', priority: 'high' } }, ({ task }) => {
    // Test should have both suite and test meta
    expect(task.meta).toMatchObject({
      suiteLevel: 'test-suite',
      testLevel: 'individual-test',
      priority: 'high', // test meta should override suite meta
    })

    // beforeEach should have access to merged meta
    expect(beforeEachMeta).toMatchObject({
      suiteLevel: 'test-suite',
      testLevel: 'individual-test',
      priority: 'high',
    })
  })

  test('should inherit suite meta when no test meta provided', ({ task }) => {
    // Test should only have suite meta
    expect(task.meta).toMatchObject({
      suiteLevel: 'test-suite',
      priority: 'medium',
    })

    // beforeEach should have access to suite meta
    expect(beforeEachMeta).toMatchObject({
      suiteLevel: 'test-suite',
      priority: 'medium',
    })
  })

  test('should allow adding meta at runtime', { meta: { testLevel: 'runtime-test' } }, ({ task }) => {
    // Add meta at runtime
    task.meta.runtimeAdded = 'added-during-test'

    expect(task.meta).toMatchObject({
      suiteLevel: 'test-suite',
      testLevel: 'runtime-test',
      priority: 'medium',
      runtimeAdded: 'added-during-test',
    })
  })

  test('should differentiate between task.meta and task.suite.meta', { meta: { testLevel: 'child-test', priority: 'high' } }, ({ task }) => {
    // task.meta should contain merged metadata (suite + test)
    expect(task.meta).toMatchObject({
      suiteLevel: 'test-suite',
      testLevel: 'child-test',
      priority: 'high', // test overrides suite
    })

    // task.suite.meta should contain only suite's own metadata
    expect(task.suite?.meta).toMatchObject({
      suiteLevel: 'test-suite',
      priority: 'medium', // original suite priority
    })

    // They should be different objects
    expect(task.meta).not.toBe(task.suite?.meta)

    // task.suite.meta should NOT have test-specific metadata
    expect(task.suite?.meta).not.toHaveProperty('testLevel')
  })
})

describe('Suite without meta', () => {
  let beforeEachMeta: Record<string, unknown>

  beforeEach(({ task }) => {
    beforeEachMeta = { ...task.meta }
  })

  test('should only have test meta when suite has no meta', { meta: { testOnly: 'test-meta' } }, ({ task }) => {
    expect(task.meta).toMatchObject({
      testOnly: 'test-meta',
    })

    expect(beforeEachMeta).toMatchObject({
      testOnly: 'test-meta',
    })
  })
})

describe('Nested describes metadata cascading', { meta: { grandparent: 'top-level', priority: 'low' } }, () => {
  describe('Middle suite', { meta: { parent: 'middle-level', priority: 'medium' } }, () => {
    test('should cascade metadata from all ancestor suites', ({ task }) => {
      // Should now get metadata from all ancestors: grandparent + parent
      expect(task.meta).toMatchObject({
        grandparent: 'top-level', // from grandparent suite
        parent: 'middle-level', // from parent suite
        priority: 'medium', // parent overrides grandparent
      })

      // Original suite metadata should be preserved
      expect(task.suite?.meta).toMatchObject({
        parent: 'middle-level',
        priority: 'medium',
      })

      // Grandparent suite metadata should also be preserved
      expect(task.suite?.suite?.meta).toMatchObject({
        grandparent: 'top-level',
        priority: 'low',
      })
    })

    test('test metadata should override cascaded suite metadata', { meta: { testLevel: 'child', priority: 'highest' } }, ({ task }) => {
      // Should get metadata from all ancestors plus test metadata
      expect(task.meta).toMatchObject({
        grandparent: 'top-level', // from grandparent suite
        parent: 'middle-level', // from parent suite
        testLevel: 'child', // from test
        priority: 'highest', // test overrides all ancestors
      })
    })
  })
})
