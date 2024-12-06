import type { File, Test } from '@vitest/runner'
import type { TestSpecification } from 'vitest/node'
import type { Reporter } from 'vitest/reporters'
import type { HookOptions } from '../../../packages/vitest/src/node/reporters/task-parser'
import { expect, test } from 'vitest'
import { TaskParser } from '../../../packages/vitest/src/node/reporters/task-parser'
import { runVitest } from '../../test-utils'

test('tasks are reported in correct order', async () => {
  const reporter = new TaskReporter()

  const { stdout, stderr } = await runVitest({
    config: false,
    include: ['./fixtures/task-parser-tests/*.test.ts'],
    fileParallelism: false,
    reporters: [reporter],
    sequence: { sequencer: Sorter },
  })

  expect(stdout).toBe('')
  expect(stderr).toBe('')

  expect(reporter.calls).toMatchInlineSnapshot(`
    [
      "|fixtures/task-parser-tests/example-1.test.ts| start",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeAll start (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| start",
      "|fixtures/task-parser-tests/example-1.test.ts| RUN some test",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach start (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| RUN some test",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterEach start (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| DONE some test",
      "|fixtures/task-parser-tests/example-1.test.ts| DONE Fast test 1",
      "|fixtures/task-parser-tests/example-1.test.ts| RUN parallel slow tests 1.1",
      "|fixtures/task-parser-tests/example-1.test.ts| RUN parallel slow tests 1.2",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| DONE parallel slow tests 1.1",
      "|fixtures/task-parser-tests/example-1.test.ts| DONE parallel slow tests 1.2",
      "|fixtures/task-parser-tests/example-1.test.ts| start",
      "|fixtures/task-parser-tests/example-1.test.ts| afterAll start (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| afterAll end (suite)",
      "|fixtures/task-parser-tests/example-1.test.ts| DONE Skipped test 1",
      "|fixtures/task-parser-tests/example-1.test.ts| finish",
      "|fixtures/task-parser-tests/example-2.test.ts| start",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeAll start (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| start",
      "|fixtures/task-parser-tests/example-2.test.ts| RUN some test",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach start (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| RUN some test",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterEach start (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| DONE some test",
      "|fixtures/task-parser-tests/example-2.test.ts| DONE Fast test 1",
      "|fixtures/task-parser-tests/example-2.test.ts| RUN parallel slow tests 2.1",
      "|fixtures/task-parser-tests/example-2.test.ts| RUN parallel slow tests 2.2",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterEach end (test)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| DONE parallel slow tests 2.1",
      "|fixtures/task-parser-tests/example-2.test.ts| DONE parallel slow tests 2.2",
      "|fixtures/task-parser-tests/example-2.test.ts| start",
      "|fixtures/task-parser-tests/example-2.test.ts| afterAll start (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| beforeAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| afterAll end (suite)",
      "|fixtures/task-parser-tests/example-2.test.ts| DONE Skipped test 1",
      "|fixtures/task-parser-tests/example-2.test.ts| finish",
    ]
  `)
})

class TaskReporter extends TaskParser implements Reporter {
  calls: string[] = []

  // @ts-expect-error -- not sure why
  onInit(ctx) {
    super.onInit(ctx)
  }

  onTestFilePrepare(file: File) {
    this.calls.push(`|${file.name}| start`)
  }

  onTestFileFinished(file: File) {
    this.calls.push(`|${file.name}| finish`)
  }

  onTestStart(test: Test) {
    this.calls.push(`|${test.file.name}| RUN ${test.name}`)
  }

  onTestFinished(test: Test) {
    this.calls.push(`|${test.file.name}| DONE ${test.name}`)
  }

  onHookStart(options: HookOptions) {
    this.calls.push(`|${options.file.name}| ${options.name} start (${options.type})`)
  }

  onHookEnd(options: HookOptions) {
    this.calls.push(`|${options.file.name}| ${options.name} end (${options.type})`)
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
