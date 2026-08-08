import type { RunnerTask, RunnerTestFile } from 'vitest'
import type { FileTreeNode, SuiteTreeNode } from '~/composables/explorer/types'
import { beforeEach, describe, expect, it } from 'vitest'
import { explorerTree } from '~/composables/explorer'
import { createOrUpdateFileNode } from '~/composables/explorer/utils'

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

function buildFile(tasks: Array<TestSpec | SuiteSpec>): RunnerTestFile {
  const file = {
    id: 'file-1',
    name: 'sample.test.ts',
    type: 'suite',
    mode: 'run',
    meta: {},
    filepath: '/sample.test.ts',
    projectName: '',
    result: { state: 'fail' },
    tasks: [],
  } as unknown as RunnerTestFile

  file.tasks = tasks.map(task =>
    'children' in task ? buildSuite(task, file) : buildTest(task, file),
  )

  return file
}

function fileNode() {
  return explorerTree.nodes.get('file-1') as FileTreeNode
}

function childIds(node: FileTreeNode | SuiteTreeNode) {
  return node.tasks.map(task => task.id)
}

describe('explorer tree re-collect', () => {
  beforeEach(() => {
    explorerTree.nodes.clear()
    explorerTree.root.tasks.length = 0
  })

  it('removes a test that no longer exists when the file is re-collected', () => {
    createOrUpdateFileNode(
      buildFile([
        { id: 't1', name: 'kept', state: 'pass' },
        {
          id: 's1',
          name: 'suite',
          children: [
            { id: 't2', name: 'removed', state: 'fail' },
            { id: 't3', name: 'sibling', state: 'pass' },
          ],
        },
      ]),
      true,
    )

    const suite = explorerTree.nodes.get('s1') as SuiteTreeNode
    expect(childIds(suite)).toEqual(['t2', 't3'])
    expect(explorerTree.nodes.has('t2')).toBe(true)

    // re-collect after the failing test was deleted from the source file
    createOrUpdateFileNode(
      buildFile([
        { id: 't1', name: 'kept', state: 'pass' },
        {
          id: 's1',
          name: 'suite',
          children: [{ id: 't3', name: 'sibling', state: 'pass' }],
        },
      ]),
      true,
    )

    expect(explorerTree.nodes.has('t2')).toBe(false)
    expect(suite.children.has('t2')).toBe(false)
    expect(childIds(suite)).toEqual(['t3'])
    // untouched tasks are preserved
    expect(explorerTree.nodes.has('t3')).toBe(true)
    expect(childIds(fileNode())).toEqual(['t1', 's1'])
  })

  it('removes an entire suite and its descendants when it is gone', () => {
    createOrUpdateFileNode(
      buildFile([
        { id: 't1', name: 'kept', state: 'pass' },
        {
          id: 's1',
          name: 'suite',
          children: [{ id: 't3', name: 'nested', state: 'pass' }],
        },
      ]),
      true,
    )

    expect(childIds(fileNode())).toEqual(['t1', 's1'])

    createOrUpdateFileNode(
      buildFile([{ id: 't1', name: 'kept', state: 'pass' }]),
      true,
    )

    expect(childIds(fileNode())).toEqual(['t1'])
    expect(fileNode().children.has('s1')).toBe(false)
    expect(explorerTree.nodes.has('s1')).toBe(false)
    // the suite's child must be removed too
    expect(explorerTree.nodes.has('t3')).toBe(false)
  })

  it('keeps existing tasks and registers new ones on re-collect', () => {
    createOrUpdateFileNode(
      buildFile([{ id: 't1', name: 'a', state: 'pass' }]),
      true,
    )

    createOrUpdateFileNode(
      buildFile([
        { id: 't1', name: 'a', state: 'pass' },
        { id: 't2', name: 'b', state: 'pass' },
      ]),
      true,
    )

    expect(childIds(fileNode())).toEqual(['t1', 't2'])
    expect(explorerTree.nodes.has('t1')).toBe(true)
    expect(explorerTree.nodes.has('t2')).toBe(true)
  })
})
