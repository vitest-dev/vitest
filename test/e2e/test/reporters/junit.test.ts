import type { Task } from '@vitest/runner'
import type { RunnerTaskResult, RunnerTestCase, RunnerTestFile, RunnerTestSuite } from 'vitest'
import { runVitest, runVitestCli } from '#test-utils'
import { createFileTask } from '@vitest/runner/utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { rolldownVersion } from 'vitest/node'

const root = resolve(import.meta.dirname, '../../fixtures/reporters')

test('calc the duration used by junit', () => {
  const result: RunnerTaskResult = { state: 'pass', duration: 0 }
  const file: RunnerTestFile = createFileTask('/test.ts', '/', 'test')
  const suiteName
    = 'suite'
  const suite: RunnerTestSuite = {
    id: '1_0',
    type: 'suite',
    name: suiteName,
    fullName: `${file.fullName} > ${suiteName}`,
    fullTestName: `${file.fullTestName} > ${suiteName}`,
    mode: 'run',
    tasks: [],
    file,
    meta: {},
  }
  const taskName = 'timeout'
  const task: RunnerTestCase = {
    id: '1_0_0',
    type: 'test',
    name: taskName,
    fullName: `${suite.fullName} > ${suiteName}`,
    fullTestName: `${suite.fullTestName} > ${suiteName}`,
    mode: 'run',
    result,
    annotations: [],
    artifacts: [],
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
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/reporters/suite-hook-failure' })

  const xml = stabilizeReport(stdout)

  expect(xml).toMatchSnapshot()
})

test('time', async () => {
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/reporters/duration' })

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
  const { stdout } = await runVitest({ reporters: 'junit', root: './fixtures/reporters/better-testsuite-name' })

  const xml = stabilizeReport(stdout)

  expect(xml).toContain('<testsuite name="space-1/test/base.test.ts" timestamp="..." hostname="..." tests="1" failures="0" errors="0" skipped="0" time="...">')
  expect(xml).toContain('<testsuite name="space-2/test/base.test.ts" timestamp="..." hostname="..." tests="1" failures="0" errors="0" skipped="0" time="...">')
})

test('options.suiteName changes name property', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { suiteName: 'some-custom-suiteName' }]],
    root: './fixtures/reporters/default',
    include: ['a.test.ts'],
  })

  const xml = stabilizeReport(stdout)

  expect(xml).not.toContain('<testsuites name="vitest tests"')
  expect(xml).toContain('<testsuites name="some-custom-suiteName"')
})

function stabilizeReport(report: string) {
  let normalized = report.replaceAll(/(timestamp|hostname|time)=".*?"/g, '$1="..."')
  // rolldown's source map for the inline async IIFE on error.test.ts:16 anchors
  // one column later than rollup's; align to rollup so the snapshot stays bundler-agnostic.
  if (rolldownVersion) {
    normalized = normalized.replaceAll(' ❯ error.test.ts:16:29', ' ❯ error.test.ts:16:28')
  }
  return normalized
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
    resolve(import.meta.dirname, '../fixtures/reporters/many-errors'),
  )
  expect(stderr).not.toContain('MaxListenersExceededWarning')
})

test('CLI reporter option preserves config file options', async () => {
  const { stdout } = await runVitestCli(
    'run',
    '--reporter=junit',
    '--root',
    resolve(import.meta.dirname, '../../fixtures/reporters/junit-cli-options'),
  )

  const xml = stabilizeReport(stdout)

  // Verify that suiteName from config is preserved
  expect(xml).not.toContain('<testsuites name="vitest tests"')
  expect(xml).toContain('<testsuites name="custom-suite-name"')

  // Verify that addFileAttribute from config is preserved
  expect(xml).toContain('file="')
})

test('suiteNameTemplate string uses {title} (first top-level describe)', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { suiteNameTemplate: '{title}' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  expect(xml).toMatchInlineSnapshot(`
    "<?xml version="1.0" encoding="UTF-8" ?>
    <testsuites name="vitest tests" tests="4" failures="0" errors="0" time="...">
        <testsuite name="MyModule" timestamp="..." hostname="..." tests="4" failures="0" errors="0" skipped="0" time="...">
            <testcase classname="sample.test.ts" name="MyModule &gt; feature A &gt; works correctly" time="...">
            </testcase>
            <testcase classname="sample.test.ts" name="MyModule &gt; feature A &gt; handles edge case" time="...">
            </testcase>
            <testcase classname="sample.test.ts" name="MyModule &gt; top-level in describe" time="...">
            </testcase>
            <testcase classname="sample.test.ts" name="top-level test" time="...">
            </testcase>
        </testsuite>
    </testsuites>
    "
  `)
})

test('suiteNameTemplate string uses {basename}', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { suiteNameTemplate: '{basename}' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  expect(xml).toContain('<testsuite name="sample.test.ts"')
})

test('suiteNameTemplate function', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { suiteNameTemplate: (vars: any) => `custom:${vars.title}` }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  // {title} resolves to the first top-level describe block name
  expect(xml).toContain('<testsuite name="custom:MyModule"')
})

test('titleTemplate {title} gives leaf test name only', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { titleTemplate: '{title}' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  expect(xml).toMatchInlineSnapshot(`
    "<?xml version="1.0" encoding="UTF-8" ?>
    <testsuites name="vitest tests" tests="4" failures="0" errors="0" time="...">
        <testsuite name="sample.test.ts" timestamp="..." hostname="..." tests="4" failures="0" errors="0" skipped="0" time="...">
            <testcase classname="sample.test.ts" name="works correctly" time="...">
            </testcase>
            <testcase classname="sample.test.ts" name="handles edge case" time="...">
            </testcase>
            <testcase classname="sample.test.ts" name="top-level in describe" time="...">
            </testcase>
            <testcase classname="sample.test.ts" name="top-level test" time="...">
            </testcase>
        </testsuite>
    </testsuites>
    "
  `)
})

test('titleTemplate {classname} {title} with ancestorSeparator', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { titleTemplate: '{classname} > {title}', ancestorSeparator: ' > ' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  // classname = ancestor path, title = leaf name – combined they match the default
  // Note: > in attribute values is XML-escaped to &gt;
  expect(xml).toContain('name="MyModule &gt; feature A &gt; works correctly"')
  expect(xml).toContain('name="MyModule &gt; top-level in describe"')
  // top-level test has empty classname, so template starts with " > title"
  expect(xml).toContain('name=" &gt; top-level test"')
})

test('titleTemplate function', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { titleTemplate: (vars: any) => `[${vars.suitename}] ${vars.title}` }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  expect(xml).toContain('name="[MyModule] works correctly"')
  expect(xml).toContain('name="[MyModule] handles edge case"')
  expect(xml).toContain('name="[MyModule] top-level in describe"')
  expect(xml).toContain('name="[] top-level test"')
})

test('classnameTemplate {classname} gives ancestor describe path', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { classnameTemplate: '{classname}' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  // Note: > in attribute values is XML-escaped to &gt;
  expect(xml).toContain('classname="MyModule &gt; feature A"')
  expect(xml).toContain('classname="MyModule"')
  expect(xml).toContain('classname=""')
})

test('classnameTemplate {basename} gives file basename', async () => {
  const root = resolve(import.meta.dirname, '../../fixtures/reporters/better-testsuite-name')
  const { stdout } = await runVitest({
    reporters: [['junit', { classnameTemplate: '{basename}' }]],
    root,
  })
  const xml = stabilizeReport(stdout)
  // Relative path would be "space-1/test/base.test.ts" but basename is just "base.test.ts"
  expect(xml).not.toContain('classname="space-1/test/base.test.ts"')
  expect(xml).toContain('classname="base.test.ts"')
})

test('classnameTemplate {suitename} gives top-level describe name', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { classnameTemplate: '{suitename}' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  expect(xml).toContain('classname="MyModule"')
  // top-level test has no suitename
  expect(xml).toContain('classname=""')
})

test('ancestorSeparator changes separator in default testcase name', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { ancestorSeparator: ' \u203A ' }]],
    root: './fixtures/reporters/junit-options',
  })
  const xml = stabilizeReport(stdout)
  expect(xml).toContain('name="MyModule \u203A feature A \u203A works correctly"')
  expect(xml).not.toContain('name="MyModule &gt; feature A &gt; works correctly"')
})

test('stackTrace set to false omits stack trace content from failure', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { stackTrace: false }]],
    root,
    include: ['error.test.ts'],
  })
  const xml = stabilizeReport(stdout)
  // failure elements are present but their text content (stack trace) is absent
  expect(xml).toContain('<failure')
  expect(xml).not.toContain('❯ error.test.ts')
})

test('emits one <testcase> per unhandled error and titles them by error.type', async () => {
  const { stdout } = await runVitest({
    reporters: 'junit',
    root: './fixtures/reporters/unhandled-errors-multi',
  })
  expect(stabilizeReport(stdout)).toMatchSnapshot()
})

test('resolves unhandled errors to the owning project in a multi-project workspace', async () => {
  const { stdout } = await runVitest({
    reporters: [['junit', { addFileAttribute: true }]],
    root: './fixtures/reporters/unhandled-errors-multi-project',
  })
  expect(stabilizeReport(stdout)).toMatchSnapshot()
})

function executionTime(durationMS: number) {
  return (durationMS / 1000).toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 10,
  })
}

export function getDuration(task: Task): string | undefined {
  const duration = task.result?.duration ?? 0
  return executionTime(duration)
}
