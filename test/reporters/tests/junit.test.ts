import type { Suite, Task, TaskResult } from 'vitest'
import { expect, test } from 'vitest'
import { resolve } from 'pathe'
import { runVitest } from '../../test-utils'
import { getDuration } from '../../../packages/vitest/src/node/reporters/junit'

const root = resolve(__dirname, '../fixtures')

test('calc the duration used by junit', () => {
  const result: TaskResult = { state: 'pass', duration: 0 }
  const suite: Suite = {
    id: '1',
    type: 'suite',
    name: 'suite',
    mode: 'run',
    tasks: [],
    meta: {},
    projectName: '',
  }
  const task: Task = {
    id: '1',
    type: 'test',
    name: 'timeout',
    mode: 'run',
    result,
    context: null as any,
    suite,
    meta: {},
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

test('emits <failure> if a test has a syntax error', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root }, ['with-syntax-error'])

  let xml = stdout

  // clear timestamp and hostname
  xml = xml.replace(/timestamp="[^"]+"/, 'timestamp="TIMESTAMP"')
  xml = xml.replace(/hostname="[^"]+"/, 'hostname="HOSTNAME"')

  expect(xml).toContain('<testsuite name="with-syntax-error.test.js" timestamp="TIMESTAMP" hostname="HOSTNAME" tests="1" failures="1" errors="0" skipped="0" time="0">')
  expect(xml).toContain('<failure')
})

test('emits <failure> when beforeAll/afterAll failed', async () => {
  let { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/suite-hook-failure' })
  // reduct non-deterministic output
  stdout = stdout.replaceAll(/(timestamp|hostname|time)=".*?"/g, '$1="..."')
  expect(stdout).toMatchSnapshot()
})
