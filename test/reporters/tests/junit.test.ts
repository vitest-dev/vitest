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

  const xml = stabilizeReport(stdout)

  expect(xml).toContain('<testsuite name="with-syntax-error.test.js" timestamp="..." hostname="..." tests="1" failures="1" errors="0" skipped="0" time="...">')
  expect(xml).toContain('<failure')
})

test('emits <failure> when beforeAll/afterAll failed', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/suite-hook-failure' })

  const xml = stabilizeReport(stdout)

  expect(xml).toMatchSnapshot()
})

test('write testsuite name relative to root config', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/better-testsuite-name' })

  const xml = stabilizeReport(stdout)

  expect(xml).toContain('<testsuite name="space-1/test/base.test.ts" timestamp="..." hostname="..." tests="1" failures="0" errors="0" skipped="0" time="...">')
  expect(xml).toContain('<testsuite name="space-2/test/base.test.ts" timestamp="..." hostname="..." tests="1" failures="0" errors="0" skipped="0" time="...">')
})

test('options.classname changes classname property', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { classname: 'some-custom-classname' }]],
    root: './fixtures/default',
    include: ['a.test.ts'],
  })

  const xml = stabilizeReport(stdout)

  // All classname attributes should have the custom value
  expect(xml.match(/<testcase classname="a\.test\.ts"/g)).toBeNull()
  expect(xml.match(/<testcase classname="/g)).toHaveLength(13)
  expect(xml.match(/<testcase classname="some-custom-classname"/g)).toHaveLength(13)
})

test('options.suiteName changes name property', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { suiteName: 'some-custom-suiteName' }]],
    root: './fixtures/default',
    include: ['a.test.ts'],
  })

  const xml = stabilizeReport(stdout)

  expect(xml).not.toContain('<testsuites name="vitest tests"')
  expect(xml).toContain('<testsuites name="some-custom-suiteName"')
})

function stabilizeReport(report: string) {
  return report.replaceAll(/(timestamp|hostname|time)=".*?"/g, '$1="..."')
}
