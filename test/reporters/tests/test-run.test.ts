import type { TestSpecification, UserConfig } from 'vitest/node'
import type { HookOptions, Reporter, TestCase, TestModule } from 'vitest/reporters'
import { sep } from 'node:path'
import { expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'

test('single test case', async () => {
  const calls = await run({
    'single-test.test.ts': ts`
      import { test } from 'vitest';

      test('example', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    [
      "onTestModuleQueued (single-test.test.ts)",
      "onTestModuleStart (single-test.test.ts)",
      "onTestCaseStart |example| (single-test.test.ts)",
      "onTestCaseEnd |example| (single-test.test.ts)",
      "onTestModuleEnd (single-test.test.ts)",
    ]
  `)
})

test('multiple test cases', async () => {
  const calls = await run({
    'multiple-test.test.ts': ts`
      import { test } from 'vitest';

      test('first', () => {});
      test('second', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    [
      "onTestModuleQueued (multiple-test.test.ts)",
      "onTestModuleStart (multiple-test.test.ts)",
      "onTestCaseStart |first| (multiple-test.test.ts)",
      "onTestCaseStart |second| (multiple-test.test.ts)",
      "onTestCaseEnd |first| (multiple-test.test.ts)",
      "onTestCaseEnd |second| (multiple-test.test.ts)",
      "onTestModuleEnd (multiple-test.test.ts)",
    ]
  `)
})

test('multiple test modules', async () => {
  const calls = await run({
    'first.test.ts': ts`
      import { test } from 'vitest';

      test('first test case', () => {});
    `,
    'second.test.ts': ts`
      import { test } from 'vitest';

      test('second test case', () => {});
    `,
  })

  expect(calls).toMatchInlineSnapshot(`
    [
      "onTestModuleQueued (first.test.ts)",
      "onTestModuleStart (first.test.ts)",
      "onTestCaseStart |first test case| (first.test.ts)",
      "onTestCaseEnd |first test case| (first.test.ts)",
      "onTestModuleEnd (first.test.ts)",
      "onTestModuleQueued (second.test.ts)",
      "onTestModuleStart (second.test.ts)",
      "onTestCaseStart |second test case| (second.test.ts)",
      "onTestCaseEnd |second test case| (second.test.ts)",
      "onTestModuleEnd (second.test.ts)",
    ]
  `)
})

async function run(structure: Parameters<typeof runInlineTests>[0]) {
  const reporter = new CustomReporter()

  const config: UserConfig = {
    config: false,
    fileParallelism: false,
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

  return reporter.calls
}

class CustomReporter implements Reporter {
  calls: string[] = []

  onTestModuleQueued(module: TestModule) {
    this.calls.push(`onTestModuleQueued (${normalizeFilename(module)})`)
  }

  onTestModuleStart(module: TestModule) {
    this.calls.push(`onTestModuleStart (${normalizeFilename(module)})`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`onTestModuleEnd (${normalizeFilename(module)})`)
  }

  onTestCaseStart(test: TestCase) {
    this.calls.push(`onTestCaseStart |${test.name}| (${normalizeFilename(test.module)})`)
  }

  onTestCaseEnd(test: TestCase) {
    this.calls.push(`onTestCaseEnd |${test.name}| (${normalizeFilename(test.module)})`)
  }

  __onHookStart(hook: HookOptions) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    this.calls.push(`onHookStart [${hook.name} / ${hook.entity.type}]${name} (${normalizeFilename(module)})`)
  }

  __onHookEnd(hook: HookOptions) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    this.calls.push(`onHookEnd [${hook.name} / ${hook.entity.type}]${name} (${normalizeFilename(module)})`)
  }
}

function normalizeFilename(module: TestModule) {
  return module.moduleId
    .replace(module.project.config.root, '')
    .replaceAll(sep, '/')
    .substring(1)
}
