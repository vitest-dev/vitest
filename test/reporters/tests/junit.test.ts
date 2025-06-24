import type { RunnerTaskResult, RunnerTestCase, RunnerTestFile, RunnerTestSuite } from 'vitest'
import { createFileTask } from '@vitest/runner/utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { getDuration } from '../../../packages/vitest/src/node/reporters/junit'
import { runVitest, runVitestCli } from '../../test-utils'

const root = resolve(__dirname, '../fixtures')

test('calc the duration used by junit', () => {
  const result: RunnerTaskResult = { state: 'pass', duration: 0 }
  const file: RunnerTestFile = createFileTask('/test.ts', '/', 'test')
  const suite: RunnerTestSuite = {
    id: '1_0',
    type: 'suite',
    name: 'suite',
    mode: 'run',
    tasks: [],
    file,
    meta: {},
  }
  const task: RunnerTestCase = {
    id: '1_0_0',
    type: 'test',
    name: 'timeout',
    mode: 'run',
    result,
    annotations: [],
    file,
    timeout: 0,
    context: null as any,
    suite,
    meta: {},
  }
  file.tasks = [suite]
  suite.tasks = [task]
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

test('time', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/duration' })

  const xml = stabilizeReportWOTime(stdout)

  const fastTestRegex = /<testcase classname="basic\.test\.ts" name="fast" time="(?<floatNumber>[\d.]+)">/
  const fastTestTime = matchJunitTime(xml, fastTestRegex)
  expect(fastTestTime).toBeGreaterThan(0)

  const slowTestRegex = /<testcase classname="basic\.test\.ts" name="slow" time="(?<floatNumber>[\d.]+)">/
  const slowTestTime = matchJunitTime(xml, slowTestRegex)
  expect(slowTestTime).toBeGreaterThan(0.2)

  const testsuiteRegex = /<testsuite name="basic\.test\.ts" timestamp="\.\.\." hostname="\.\.\." tests="2" failures="0" errors="0" skipped="0" time="(?<floatNumber>[\d.]+)">/
  const testsuiteTime = matchJunitTime(xml, testsuiteRegex)
  expect(testsuiteTime).toBeCloseTo(fastTestTime + slowTestTime, 1)

  const testsuitesRegex = /<testsuites name="vitest tests" tests="2" failures="0" errors="0" time="(?<floatNumber>[\d.]+)">/
  const testsuitesTime = matchJunitTime(xml, testsuitesRegex)
  expect(testsuitesTime).toBeCloseTo(testsuiteTime, 1)
})

test('format error', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root }, ['error.test.ts'])
  expect(stabilizeReport(stdout)).toMatchSnapshot()
})

test('write testsuite name relative to root config', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/better-testsuite-name' })

  const xml = stabilizeReport(stdout)

  expect(xml).toContain('<testsuite name="space-1/test/base.test.ts" timestamp="..." hostname="..." tests="1" failures="0" errors="0" skipped="0" time="...">')
  expect(xml).toContain('<testsuite name="space-2/test/base.test.ts" timestamp="..." hostname="..." tests="1" failures="0" errors="0" skipped="0" time="...">')
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

function stabilizeReportWOTime(report: string) {
  return report.replaceAll(/(timestamp|hostname)=".*?"/g, '$1="..."')
}

function matchJunitTime(xml: string, regex: RegExp) {
  const match = xml.match(regex)
  expect(match).not.toBeNull()
  const time = Number.parseFloat(match!.groups!.floatNumber)
  expect(time).toBeGreaterThanOrEqual(0)
  return time
}

test.each([true, false])('includeConsoleOutput %s', async (t) => {
  const { stdout } = await runVitest({
    reporters: [['junit', { includeConsoleOutput: t }]],
    root,
    include: ['console-simple.test.ts'],
  })
  expect(stabilizeReport(stdout)).matchSnapshot()
})

test.each([true, false])('addFileAttribute %s', async (t) => {
  const { stdout } = await runVitest({
    reporters: [['junit', { addFileAttribute: t }]],
    root,
    include: ['ok.test.ts'],
  })
  expect(stabilizeReport(stdout)).matchSnapshot()
})

test('many errors without warning', async () => {
  const { stderr } = await runVitestCli(
    'run',
    '--reporter=junit',
    '--root',
    resolve(import.meta.dirname, '../fixtures/many-errors'),
  )
  expect(stderr).not.toContain('MaxListenersExceededWarning')
})
