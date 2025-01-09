import type { TestSpecification, UserConfig } from 'vitest/node'
import type { HookOptions, Reporter, TestCase, TestModule } from 'vitest/reporters'
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
    onTestModuleQueued  (single-test.test.ts)
    onTestModuleStart   (single-test.test.ts)
        onTestCaseStart |example| (single-test.test.ts)
        onTestCaseEnd   |example| (single-test.test.ts)
    onTestModuleEnd     (single-test.test.ts)"
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
    onTestModuleQueued  (example-test.test.ts)
    onTestModuleStart   (example-test.test.ts)
        onTestCaseStart |skipped| (example-test.test.ts)
        onTestCaseEnd   |skipped| (example-test.test.ts)
        onTestCaseStart |running| (example-test.test.ts)
        onTestCaseEnd   |running| (example-test.test.ts)
    onTestModuleEnd     (example-test.test.ts)"
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
    onTestModuleQueued  (skipped-tests.test.ts)
    onTestModuleStart   (skipped-tests.test.ts)
        onTestCaseStart |first| (skipped-tests.test.ts)
        onTestCaseEnd   |first| (skipped-tests.test.ts)
        onTestCaseStart |second| (skipped-tests.test.ts)
        onTestCaseEnd   |second| (skipped-tests.test.ts)
    onTestModuleEnd     (skipped-tests.test.ts)"
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
    onTestModuleQueued  (multiple-test.test.ts)
    onTestModuleStart   (multiple-test.test.ts)
        onTestCaseStart |first| (multiple-test.test.ts)
        onTestCaseEnd   |first| (multiple-test.test.ts)
        onTestCaseStart |second| (multiple-test.test.ts)
        onTestCaseEnd   |second| (multiple-test.test.ts)
    onTestModuleEnd     (multiple-test.test.ts)"
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
    onTestModuleQueued  (first.test.ts)
    onTestModuleStart   (first.test.ts)
        onTestCaseStart |first test case| (first.test.ts)
        onTestCaseEnd   |first test case| (first.test.ts)
    onTestModuleEnd     (first.test.ts)

    onTestModuleQueued  (second.test.ts)
    onTestModuleStart   (second.test.ts)
        onTestCaseStart |second test case| (second.test.ts)
        onTestCaseEnd   |second test case| (second.test.ts)
    onTestModuleEnd     (second.test.ts)"
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
    onTestModuleQueued  (single-test.test.ts)
    onTestModuleStart   (single-test.test.ts)
        onTestCaseStart |first| (single-test.test.ts)
            onHookStart [beforeEach] |first| (single-test.test.ts)
            onHookEnd   [beforeEach] |first| (single-test.test.ts)
        onTestCaseEnd   |first| (single-test.test.ts)
        onTestCaseStart |second| (single-test.test.ts)
            onHookStart [beforeEach] |second| (single-test.test.ts)
            onHookEnd   [beforeEach] |second| (single-test.test.ts)
        onTestCaseEnd   |second| (single-test.test.ts)
    onTestModuleEnd     (single-test.test.ts)"
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
    onTestModuleQueued  (single-test.test.ts)
    onTestModuleStart   (single-test.test.ts)
        onTestCaseStart |first| (single-test.test.ts)
            onHookStart [afterEach] |first| (single-test.test.ts)
            onHookEnd   [afterEach] |first| (single-test.test.ts)
        onTestCaseEnd   |first| (single-test.test.ts)
        onTestCaseStart |second| (single-test.test.ts)
            onHookStart [afterEach] |second| (single-test.test.ts)
            onHookEnd   [afterEach] |second| (single-test.test.ts)
        onTestCaseEnd   |second| (single-test.test.ts)
    onTestModuleEnd     (single-test.test.ts)"
  `)
})

test.todo('beforeEach and afterEach', async () => {
  const calls = await run({
    'single-test.test.ts': ts`
      beforeEach(() => {});
      afterEach(() => {});

      test('first', () => {});
      test('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot()
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
    this.calls.push(`onTestModuleQueued  (${normalizeFilename(module)})`)
  }

  onTestModuleStart(module: TestModule) {
    this.calls.push(`onTestModuleStart   (${normalizeFilename(module)})`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`onTestModuleEnd     (${normalizeFilename(module)})\n`)
  }

  onTestCaseStart(test: TestCase) {
    this.calls.push(`    onTestCaseStart |${test.name}| (${normalizeFilename(test.module)})`)
  }

  onTestCaseEnd(test: TestCase) {
    this.calls.push(`    onTestCaseEnd   |${test.name}| (${normalizeFilename(test.module)})`)
  }

  onHookStart(hook: HookOptions) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    const padding = hook.entity.type === 'test' ? '        ' : '    '
    this.calls.push(`${`${padding}onHookStart`.padEnd(20)}[${hook.name}]${name} (${normalizeFilename(module)})`)
  }

  onHookEnd(hook: HookOptions) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    const padding = hook.entity.type === 'test' ? '        ' : '    '
    this.calls.push(`${`${padding}onHookEnd`.padEnd(20)}[${hook.name}]${name} (${normalizeFilename(module)})`)
  }
}

function normalizeFilename(module: TestModule) {
  return module.moduleId
    .replace(module.project.config.root, '')
    .replaceAll(sep, '/')
    .substring(1)
}
