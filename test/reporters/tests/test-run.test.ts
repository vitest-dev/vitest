import type { TestSpecification, UserConfig } from 'vitest/node'
import type { ReportedHookContext, Reporter, TestCase, TestModule } from 'vitest/reporters'
import { sep } from 'node:path'
import { expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'

test('single test case', async () => {
  const calls = await run({
    'single-test.test.ts': ts`
      test('example', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (single-test.test.ts)
    onTestModuleStart    (single-test.test.ts)
        onTestCaseReady  |example| (single-test.test.ts)
        onTestCaseResult |example| (single-test.test.ts)
    onTestModuleEnd      (single-test.test.ts)"
  `)
})

test('skipped test case', async () => {
  const calls = await run({
    'example-test.test.ts': ts`
      test('running', () => {});
      test.skip('skipped', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (example-test.test.ts)
    onTestModuleStart    (example-test.test.ts)
        onTestCaseReady  |skipped| (example-test.test.ts)
        onTestCaseResult |skipped| (example-test.test.ts)
        onTestCaseReady  |running| (example-test.test.ts)
        onTestCaseResult |running| (example-test.test.ts)
    onTestModuleEnd      (example-test.test.ts)"
  `)
})

test('skipped all test cases', async () => {
  const calls = await run({
    'skipped-tests.test.ts': ts`
      test.skip('first', () => {});
      test.skip('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (skipped-tests.test.ts)
    onTestModuleStart    (skipped-tests.test.ts)
        onTestCaseReady  |first| (skipped-tests.test.ts)
        onTestCaseResult |first| (skipped-tests.test.ts)
        onTestCaseReady  |second| (skipped-tests.test.ts)
        onTestCaseResult |second| (skipped-tests.test.ts)
    onTestModuleEnd      (skipped-tests.test.ts)"
  `)
})

test('multiple test cases', async () => {
  const calls = await run({
    'multiple-test.test.ts': ts`
      test('first', () => {});
      test('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (multiple-test.test.ts)
    onTestModuleStart    (multiple-test.test.ts)
        onTestCaseReady  |first| (multiple-test.test.ts)
        onTestCaseResult |first| (multiple-test.test.ts)
        onTestCaseReady  |second| (multiple-test.test.ts)
        onTestCaseResult |second| (multiple-test.test.ts)
    onTestModuleEnd      (multiple-test.test.ts)"
  `)
})

test('multiple test modules', async () => {
  const calls = await run({
    'first.test.ts': ts`
      test('first test case', () => {});
    `,
    'second.test.ts': ts`
      test('second test case', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (first.test.ts)
    onTestModuleStart    (first.test.ts)
        onTestCaseReady  |first test case| (first.test.ts)
        onTestCaseResult |first test case| (first.test.ts)
    onTestModuleEnd      (first.test.ts)

    onTestModuleQueued   (second.test.ts)
    onTestModuleStart    (second.test.ts)
        onTestCaseReady  |second test case| (second.test.ts)
        onTestCaseResult |second test case| (second.test.ts)
    onTestModuleEnd      (second.test.ts)"
  `)
})

test('beforeEach', async () => {
  const calls = await run({
    'single-test.test.ts': ts`
      beforeEach(() => {});

      test('first', () => {});
      test('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (single-test.test.ts)
    onTestModuleStart    (single-test.test.ts)
        onTestCaseReady  |first| (single-test.test.ts)
            onHookStart  [beforeEach] |first| (single-test.test.ts)
            onHookEnd    [beforeEach] |first| (single-test.test.ts)
        onTestCaseResult |first| (single-test.test.ts)
        onTestCaseReady  |second| (single-test.test.ts)
            onHookStart  [beforeEach] |second| (single-test.test.ts)
            onHookEnd    [beforeEach] |second| (single-test.test.ts)
        onTestCaseResult |second| (single-test.test.ts)
    onTestModuleEnd      (single-test.test.ts)"
  `)
})

test('afterEach', async () => {
  const calls = await run({
    'single-test.test.ts': ts`
      afterEach(() => {});

      test('first', () => {});
      test('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (single-test.test.ts)
    onTestModuleStart    (single-test.test.ts)
        onTestCaseReady  |first| (single-test.test.ts)
            onHookStart  [afterEach] |first| (single-test.test.ts)
            onHookEnd    [afterEach] |first| (single-test.test.ts)
        onTestCaseResult |first| (single-test.test.ts)
        onTestCaseReady  |second| (single-test.test.ts)
            onHookStart  [afterEach] |second| (single-test.test.ts)
            onHookEnd    [afterEach] |second| (single-test.test.ts)
        onTestCaseResult |second| (single-test.test.ts)
    onTestModuleEnd      (single-test.test.ts)"
  `)
})

test('beforeEach and afterEach', async () => {
  const calls = await run({
    'single-test.test.ts': ts`
      beforeEach(() => {});
      afterEach(() => {});

      test('first', () => {});
      test('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    "
    onTestModuleQueued   (single-test.test.ts)
    onTestModuleStart    (single-test.test.ts)
        onTestCaseReady  |first| (single-test.test.ts)
            onHookStart  [beforeEach] |first| (single-test.test.ts)
            onHookEnd    [beforeEach] |first| (single-test.test.ts)
            onHookStart  [afterEach] |first| (single-test.test.ts)
            onHookEnd    [afterEach] |first| (single-test.test.ts)
        onTestCaseResult |first| (single-test.test.ts)
        onTestCaseReady  |second| (single-test.test.ts)
            onHookStart  [beforeEach] |second| (single-test.test.ts)
            onHookEnd    [beforeEach] |second| (single-test.test.ts)
            onHookStart  [afterEach] |second| (single-test.test.ts)
            onHookEnd    [afterEach] |second| (single-test.test.ts)
        onTestCaseResult |second| (single-test.test.ts)
    onTestModuleEnd      (single-test.test.ts)"
  `)
})

async function run(structure: Parameters<typeof runInlineTests>[0]) {
  const reporter = new CustomReporter()

  const config: UserConfig = {
    config: false,
    fileParallelism: false,
    globals: true,
    reporters: [
    // @ts-expect-error -- not sure why
      reporter,
    ],
    sequence: {
      sequencer: class Sorter {
        sort(files: TestSpecification[]) {
          return files.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
        }

        shard(files: TestSpecification[]) {
          return files
        }
      },
    },
  }

  const { stdout, stderr } = await runInlineTests(structure, config)

  expect(stdout).toBe('')
  expect(stderr).toBe('')

  return `\n${reporter.calls.join('\n').trim()}`
}

class CustomReporter implements Reporter {
  calls: string[] = []

  onTestModuleQueued(module: TestModule) {
    this.calls.push(`onTestModuleQueued   (${normalizeFilename(module)})`)
  }

  onTestModuleStart(module: TestModule) {
    this.calls.push(`onTestModuleStart    (${normalizeFilename(module)})`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`onTestModuleEnd      (${normalizeFilename(module)})\n`)
  }

  onTestCaseReady(test: TestCase) {
    this.calls.push(`    onTestCaseReady  |${test.name}| (${normalizeFilename(test.module)})`)
  }

  onTestCaseResult(test: TestCase) {
    this.calls.push(`    onTestCaseResult |${test.name}| (${normalizeFilename(test.module)})`)
  }

  onHookStart(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    const padding = hook.entity.type === 'test' ? '        ' : '    '
    this.calls.push(`${`${padding}onHookStart`.padEnd(21)}[${hook.name}]${name} (${normalizeFilename(module)})`)
  }

  onHookEnd(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    const padding = hook.entity.type === 'test' ? '        ' : '    '
    this.calls.push(`${`${padding}onHookEnd`.padEnd(21)}[${hook.name}]${name} (${normalizeFilename(module)})`)
  }
}

function normalizeFilename(module: TestModule) {
  return module.moduleId
    .replace(module.project.config.root, '')
    .replaceAll(sep, '/')
    .substring(1)
}
