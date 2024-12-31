import type { TestSpecification } from 'vitest/node'
import type { Reporter, TestCase, TestModule } from 'vitest/reporters'
import { sep } from 'node:path'
import { normalize } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('tasks are reported in correct order', async () => {
  const reporter = new CustomReporter()

  const { stdout, stderr } = await runVitest({
    config: false,
    include: ['./fixtures/task-parser-tests/*.test.ts'],
    fileParallelism: false,
    reporters: [reporter],
    sequence: { sequencer: Sorter },
  })

  expect(stdout).toBe('')
  expect(stderr).toBe('')

  // TODO: Missing skipped tests, missing hooks, queued is duplicated
  expect(reporter.calls).toMatchInlineSnapshot(`
    [
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| queued",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| queued",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| start",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| RUN some test",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| DONE some test",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| DONE Fast test 1",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| RUN Fast test 1",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| RUN parallel slow tests 1.1",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| RUN parallel slow tests 1.2",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| DONE parallel slow tests 1.1",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| DONE parallel slow tests 1.2",
      "|<process-cwd>/fixtures/task-parser-tests/example-1.test.ts| finish",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| queued",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| queued",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| start",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| RUN some test",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| DONE some test",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| DONE Fast test 1",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| RUN Fast test 1",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| RUN parallel slow tests 2.1",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| RUN parallel slow tests 2.2",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| DONE parallel slow tests 2.1",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| DONE parallel slow tests 2.2",
      "|<process-cwd>/fixtures/task-parser-tests/example-2.test.ts| finish",
    ]
  `)
})

class CustomReporter implements Reporter {
  calls: string[] = []

  onTestModuleQueued(module: TestModule) {
    this.calls.push(`|${normalizeFilename(module.moduleId)}| queued`)
  }

  onTestModulePrepare(module: TestModule) {
    this.calls.push(`|${normalizeFilename(module.moduleId)}| start`)
  }

  onTestModuleFinished(module: TestModule) {
    this.calls.push(`|${normalizeFilename(module.moduleId)}| finish`)
  }

  onTestCasePrepare(test: TestCase) {
    this.calls.push(`|${normalizeFilename(test.module.moduleId)}| RUN ${test.name}`)
  }

  onTestCaseFinished(test: TestCase) {
    this.calls.push(`|${normalizeFilename(test.module.moduleId)}| DONE ${test.name}`)
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

function normalizeFilename(filename: string) {
  if (!filename.includes(process.cwd())) {
    throw new Error(`Expected ${filename} to include ${process.cwd()}`)
  }

  return normalize(filename)
    .replace(normalize(process.cwd()), '<process-cwd>')
    .replaceAll(sep, '/')
}
