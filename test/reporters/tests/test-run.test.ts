import type { TestSpecification } from 'vitest/node'
import type { HookOptions, Reporter, TestCase, TestModule } from 'vitest/reporters'
import { sep } from 'node:path'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('tasks are reported in correct order', async () => {
  const reporter = new CustomReporter()

  const { stdout, stderr } = await runVitest({
    config: false,
    include: ['./fixtures/test-run-tests/*.test.ts'],
    fileParallelism: false,
    reporters: [
      // @ts-expect-error -- not sure why
      reporter,
    ],
    sequence: { sequencer: Sorter },
  })

  expect(stdout).toBe('')
  expect(stderr).toBe('')

  // TODO: Let's split this into multiple smaller ones. Split the fixtures into smaller files too.
  expect(reporter.calls).toMatchInlineSnapshot(`
    [
      "|fixtures/test-run-tests/example-1.test.ts| queued",
      "|fixtures/test-run-tests/example-1.test.ts| start",
      "|fixtures/test-run-tests/example-1.test.ts| beforeAll start (module)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeAll end (module)",
      "|fixtures/test-run-tests/example-1.test.ts| RUN some test",
      "|fixtures/test-run-tests/example-1.test.ts| beforeAll start (suite)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach start (test) (some test)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach end (test)",
      "|fixtures/test-run-tests/example-1.test.ts| DONE some test",
      "|fixtures/test-run-tests/example-1.test.ts| DONE Fast test 1",
      "|fixtures/test-run-tests/example-1.test.ts| RUN Fast test 1",
      "|fixtures/test-run-tests/example-1.test.ts| RUN parallel slow tests 1.1",
      "|fixtures/test-run-tests/example-1.test.ts| RUN parallel slow tests 1.2",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach start (test) (some test)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeAll start (suite)",
      "|fixtures/test-run-tests/example-1.test.ts| afterAll start (suite)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (parallel slow tests 1.1)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (parallel slow tests 1.2)",
      "|fixtures/test-run-tests/example-1.test.ts| DONE parallel slow tests 1.1",
      "|fixtures/test-run-tests/example-1.test.ts| DONE parallel slow tests 1.2",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (parallel slow tests 1.1)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach start (test) (parallel slow tests 1.1)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeEach start (test) (parallel slow tests 1.2)",
      "|fixtures/test-run-tests/example-1.test.ts| afterEach start (test) (parallel slow tests 1.2)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeAll start (module)",
      "|fixtures/test-run-tests/example-1.test.ts| afterAll start (module)",
      "|fixtures/test-run-tests/example-1.test.ts| beforeAll end (module)",
      "|fixtures/test-run-tests/example-1.test.ts| afterAll end (module)",
      "|fixtures/test-run-tests/example-1.test.ts| DONE Skipped test 1",
      "|fixtures/test-run-tests/example-1.test.ts| finish",
      "|fixtures/test-run-tests/example-2.test.ts| queued",
      "|fixtures/test-run-tests/example-2.test.ts| start",
      "|fixtures/test-run-tests/example-2.test.ts| beforeAll start (module)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeAll end (module)",
      "|fixtures/test-run-tests/example-2.test.ts| RUN some test",
      "|fixtures/test-run-tests/example-2.test.ts| beforeAll start (suite)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach start (test) (some test)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach end (test)",
      "|fixtures/test-run-tests/example-2.test.ts| DONE some test",
      "|fixtures/test-run-tests/example-2.test.ts| DONE Fast test 1",
      "|fixtures/test-run-tests/example-2.test.ts| RUN Fast test 1",
      "|fixtures/test-run-tests/example-2.test.ts| RUN parallel slow tests 2.1",
      "|fixtures/test-run-tests/example-2.test.ts| RUN parallel slow tests 2.2",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (some test)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach start (test) (some test)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeAll start (suite)",
      "|fixtures/test-run-tests/example-2.test.ts| afterAll start (suite)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach start (test) (Fast test 1)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (parallel slow tests 2.1)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (parallel slow tests 2.2)",
      "|fixtures/test-run-tests/example-2.test.ts| DONE parallel slow tests 2.1",
      "|fixtures/test-run-tests/example-2.test.ts| DONE parallel slow tests 2.2",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (parallel slow tests 2.1)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach start (test) (parallel slow tests 2.1)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeEach start (test) (parallel slow tests 2.2)",
      "|fixtures/test-run-tests/example-2.test.ts| afterEach start (test) (parallel slow tests 2.2)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeAll start (module)",
      "|fixtures/test-run-tests/example-2.test.ts| afterAll start (module)",
      "|fixtures/test-run-tests/example-2.test.ts| beforeAll end (module)",
      "|fixtures/test-run-tests/example-2.test.ts| afterAll end (module)",
      "|fixtures/test-run-tests/example-2.test.ts| DONE Skipped test 1",
      "|fixtures/test-run-tests/example-2.test.ts| finish",
    ]
  `)
})

class CustomReporter implements Reporter {
  calls: string[] = []

  onTestModuleQueued(module: TestModule) {
    this.calls.push(`|${normalizeFilename(module)}| queued`)
  }

  onTestModuleStart(module: TestModule) {
    this.calls.push(`|${normalizeFilename(module)}| start`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`|${normalizeFilename(module)}| finish`)
  }

  onTestCaseStart(test: TestCase) {
    this.calls.push(`|${normalizeFilename(test.module)}| RUN ${test.name}`)
  }

  onTestCaseEnd(test: TestCase) {
    this.calls.push(`|${normalizeFilename(test.module)}| DONE ${test.name}`)
  }

  onHookStart(hook: HookOptions) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` (${hook.entity.name})` : ''
    this.calls.push(`|${normalizeFilename(module)}| ${hook.name} start (${hook.entity.type})${name}`)
  }

  onHookEnd(hook: HookOptions) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    this.calls.push(`|${normalizeFilename(module)}| ${hook.name} end (${hook.entity.type})`)
  }
}

class Sorter {
  sort(files: TestSpecification[]) {
    return files.sort((a, b) => {
      const idA = Number.parseInt(
        a.moduleId.match(/example-(\d*)\.test\.ts/)![1],
      )
      const idB = Number.parseInt(
        b.moduleId.match(/example-(\d*)\.test\.ts/)![1],
      )

      if (idA > idB) {
        return 1
      }
      if (idA < idB) {
        return -1
      }
      return 0
    })
  }

  shard(files: TestSpecification[]) {
    return files
  }
}

function normalizeFilename(module: TestModule) {
  return module.moduleId
    .replace(module.project.config.root, '')
    .replaceAll(sep, '/')
    .substring(1)
}
