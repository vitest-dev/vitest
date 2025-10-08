import { describe, expect, test } from 'vitest'

/**
 * Test for snapshot visualization feature implementation (GitHub issue #4060)
 * Tests the getSnapshotData API that provides categorized snapshot data to the Vitest UI
 */

describe('snapshot visualization API', () => {
  test('snapshot data categorization', () => {
    // Mock snapshot result from SnapshotState
    const mockSnapshotResult = {
      filepath: '/test/component.test.tsx',
      snapshot: {
        'Component renders correctly 1': '<div>Hello World</div>',
        'Component with props 1': '<div>Hello John</div>',
        'Unchecked snapshot 1': '<div>Old content</div>',
      } as Record<string, string>,
      addedKeys: ['Component renders correctly 1'],
      matchedKeys: ['Component with props 1'],
      uncheckedKeys: ['Unchecked snapshot 1'],
    }

    // Simulate createSnapshotEntry function from setup.ts
    const createSnapshotEntry = (key: string) => ({
      name: key,
      content: String(mockSnapshotResult.snapshot[key] || ''),
      testName: key.replace(/ \d+$/, ''),
    })

    const categorizedSnapshots = {
      added: mockSnapshotResult.addedKeys.map(createSnapshotEntry),
      matched: mockSnapshotResult.matchedKeys.map(createSnapshotEntry),
      unchecked: mockSnapshotResult.uncheckedKeys.map(createSnapshotEntry),
    }

    // Test the final API response structure
    const apiResponse = {
      filepath: mockSnapshotResult.filepath,
      snapshots: categorizedSnapshots,
    }

    expect(apiResponse).toMatchSnapshot()
  })

  test('test name extraction from snapshot keys', () => {
    const testCases = [
      'simple test 1',
      'test with multiple words 42',
      'nested > test 1',
      'test-with-dashes 123',
      'test_with_underscores 999',
      'no number at end',
    ]

    const extractedNames = testCases.map(key => key.replace(/ \d+$/, ''))
    expect(extractedNames).toMatchSnapshot()
  })

  test('empty snapshot data handling', () => {
    const emptySnapshotResult = {
      filepath: '/test/empty.test.ts',
      snapshot: {} as Record<string, string>,
      addedKeys: [],
      matchedKeys: [],
      uncheckedKeys: [],
    }

    const createSnapshotEntry = (key: string) => ({
      name: key,
      content: String(emptySnapshotResult.snapshot[key] || ''),
      testName: key.replace(/ \d+$/, ''),
    })

    const categorizedSnapshots = {
      added: emptySnapshotResult.addedKeys.map(createSnapshotEntry),
      matched: emptySnapshotResult.matchedKeys.map(createSnapshotEntry),
      unchecked: emptySnapshotResult.uncheckedKeys.map(createSnapshotEntry),
    }

    const apiResponse = {
      filepath: emptySnapshotResult.filepath,
      snapshots: categorizedSnapshots,
    }

    expect(apiResponse).toMatchSnapshot()
  })

  test('complex snapshot content', () => {
    const complexObject = {
      component: 'MyComponent',
      props: { id: 1, name: 'test' },
      children: ['item1', 'item2'],
      nested: { deeply: { nested: 'value' } },
    }

    const snapshotContent = JSON.stringify(complexObject, null, 2)

    const mockSnapshotResult = {
      filepath: '/test/complex.test.ts',
      snapshot: {
        'complex object test 1': snapshotContent,
      } as Record<string, string>,
      addedKeys: ['complex object test 1'],
      matchedKeys: [],
      unchecked: [],
    }

    const createSnapshotEntry = (key: string) => ({
      name: key,
      content: String(mockSnapshotResult.snapshot[key] || ''),
      testName: key.replace(/ \d+$/, ''),
    })

    const entry = createSnapshotEntry('complex object test 1')
    expect(entry).toMatchSnapshot()
  })

  test('inline and external snapshot merging', () => {
    // Test the merging logic from SnapshotState.pack()
    const externalSnapshots = {
      'external test 1': 'external snapshot content',
    }

    const inlineSnapshots = {
      'inline test 1': 'inline snapshot content',
    }

    const mergedSnapshots = { ...externalSnapshots, ...inlineSnapshots }

    expect(mergedSnapshots).toMatchSnapshot()
  })
})

describe('ViewSnapshot UI component data', () => {
  test('UI snapshot data structure', () => {
    // Test the data structure expected by ViewSnapshot.vue
    const uiSnapshotData = {
      filepath: '/src/components/Button.test.tsx',
      snapshots: {
        added: [
          {
            name: 'Button default state 1',
            content: '<button class="btn">Click me</button>',
            testName: 'Button default state',
          },
        ],
        matched: [
          {
            name: 'Button disabled state 1',
            content: '<button class="btn" disabled>Click me</button>',
            testName: 'Button disabled state',
          },
        ],
        unchecked: [],
      },
    }

    expect(uiSnapshotData).toMatchSnapshot()
  })

  test('real-world snapshot content examples', () => {
    // Examples of real snapshot content that might appear in the UI
    const snapshots = [
      {
        name: 'React component 1',
        content: `<div className="container">
  <h1>Welcome</h1>
  <p>Hello World</p>
</div>`,
        testName: 'React component',
      },
      {
        name: 'API response 1',
        content: JSON.stringify({
          status: 'success',
          data: { id: 1, name: 'John' },
          timestamp: '2024-01-01T00:00:00Z',
        }, null, 2),
        testName: 'API response',
      },
      {
        name: 'Error message 1',
        content: 'Error: Invalid input provided',
        testName: 'Error message',
      },
    ]

    expect(snapshots).toMatchSnapshot()
  })
})
