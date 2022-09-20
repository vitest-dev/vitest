import type { Suite, Task, TaskResult } from 'vitest'
import { expect, test } from 'vitest'
import { getDuration } from '../../../packages/vitest/src/node/reporters/junit'

test('calc the duration used by junit', () => {
  const result: TaskResult = { state: 'pass', duration: 0 }
  const suite: Suite = {
    id: '1',
    type: 'suite',
    name: 'suite',
    mode: 'run',
    tasks: [],
  }
  const task: Task = {
    id: '1',
    type: 'test',
    name: 'timeout',
    mode: 'run',
    result,
    context: null as any,
    suite,
  }
  expect(getDuration(task)).toBe('0')
  result.duration = 0.12
  expect(getDuration(task)).toBe('0.00012')
  result.duration = 12
  expect(getDuration(task)).toBe('0.012')
  result.duration = 12.01
  expect(getDuration(task)).toBe('0.01201')
  result.duration = 12000
  expect(getDuration(task)).toBe('12')
  result.duration = 12001
  expect(getDuration(task)).toBe('12.001')
})

