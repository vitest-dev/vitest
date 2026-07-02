import type { RunnerTask, RunnerTestFile } from 'vitest'
import type { FileTreeNode } from '~/composables/explorer/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { explorerTree } from '~/composables/explorer'
import { createOrUpdateFileNode } from '~/composables/explorer/utils'
// relative on purpose: importing the client state before `~/composables/explorer`
// trips the client module's circular init (config/testRunState TDZ)
import { StateManager } from '../client/state'

interface TestSpec {
  id: string
  name: string
  state?: 'pass' | 'fail'
}

interface SuiteSpec {
  id: string
  name: string
  children: TestSpec[]
}

function buildTest(spec: TestSpec, file: RunnerTestFile): RunnerTask {
  // a test task must not own a `tasks` property, otherwise it is treated as a suite
  return {
    id: spec.id,
    name: spec.name,
    type: 'test',
    mode: 'run',
    file,
    result: spec.state ? { state: spec.state } : undefined,
  } as unknown as RunnerTask
}

function buildSuite(spec: SuiteSpec, file: RunnerTestFile): RunnerTask {
  return {
    id: spec.id,
    name: spec.name,
    type: 'suite',
    mode: 'run',
    file,
    tasks: spec.children.map(child => buildTest(child, file)),
  } as unknown as RunnerTask
}

function buildFile(id: string, filepath: string, tasks: Array<TestSpec | SuiteSpec>): RunnerTestFile {
  const file = {
    id,
    name: filepath.slice(1),
    type: 'suite',
    mode: 'run',
    meta: {},
    filepath,
    projectName: '',
    result: { state: 'pass' },
    tasks: [],
  } as unknown as RunnerTestFile

  file.tasks = tasks.map(task =>
    'children' in task ? buildSuite(task, file) : buildTest(task, file),
  )

  return file
}

describe('explorer tree file removal', () => {
  beforeEach(() => {
    explorerTree.nodes.clear()
    explorerTree.root.tasks.length = 0
  })

  it('drops a deleted file node with its descendants and keeps the others', () => {
    createOrUpdateFileNode(
      buildFile('file-a', '/a.test.ts', [
        { id: 'a-t1', name: 'top', state: 'pass' },
        {
          id: 'a-s1',
          name: 'suite',
          children: [{ id: 'a-t2', name: 'nested', state: 'pass' }],
        },
      ]),
      true,
    )
    createOrUpdateFileNode(
      buildFile('file-b', '/b.test.ts', [{ id: 'b-t1', name: 'kept', state: 'pass' }]),
      true,
    )

    expect(explorerTree.root.tasks.map(f => f.id)).toEqual(['file-a', 'file-b'])
    expect(['file-a', 'a-t1', 'a-s1', 'a-t2'].every(id => explorerTree.nodes.has(id))).toBe(true)

    // the source file /a.test.ts was deleted (or renamed) on disk
    explorerTree.removeFiles(['/a.test.ts'])

    // the file node and every descendant are gone
    expect(explorerTree.nodes.has('file-a')).toBe(false)
    expect(explorerTree.nodes.has('a-t1')).toBe(false)
    expect(explorerTree.nodes.has('a-s1')).toBe(false)
    expect(explorerTree.nodes.has('a-t2')).toBe(false)
    expect(explorerTree.root.tasks.map(f => f.id)).toEqual(['file-b'])

    // the untouched file is preserved
    expect(explorerTree.nodes.has('file-b')).toBe(true)
    expect(explorerTree.nodes.has('b-t1')).toBe(true)
  })

  it('is a no-op when no tracked file matches the removed path', () => {
    createOrUpdateFileNode(
      buildFile('file-b', '/b.test.ts', [{ id: 'b-t1', name: 'kept', state: 'pass' }]),
      true,
    )
    const before = explorerTree.root.tasks as FileTreeNode[]

    explorerTree.removeFiles(['/gone.test.ts'])

    expect(explorerTree.root.tasks).toBe(before)
    expect(explorerTree.root.tasks.map(f => f.id)).toEqual(['file-b'])
    expect(explorerTree.nodes.has('file-b')).toBe(true)
  })
})

describe('state manager file removal', () => {
  it('removes the file and its task ids so it is not resurrected on the next collect', () => {
    const state = new StateManager()
    state.collectFiles([
      buildFile('file-a', '/a.test.ts', [
        { id: 'a-t1', name: 'top', state: 'pass' },
        {
          id: 'a-s1',
          name: 'suite',
          children: [{ id: 'a-t2', name: 'nested', state: 'pass' }],
        },
      ]),
    ])

    expect(state.filesMap.has('/a.test.ts')).toBe(true)
    expect(['file-a', 'a-t1', 'a-s1', 'a-t2'].every(id => state.idMap.has(id))).toBe(true)

    state.removeFiles(['/a.test.ts'])

    expect(state.filesMap.has('/a.test.ts')).toBe(false)
    expect(state.getFiles()).toHaveLength(0)
    expect(state.idMap.has('file-a')).toBe(false)
    expect(state.idMap.has('a-t1')).toBe(false)
    expect(state.idMap.has('a-s1')).toBe(false)
    expect(state.idMap.has('a-t2')).toBe(false)
  })
})
