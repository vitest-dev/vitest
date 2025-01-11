import type { TestSpecification, UserConfig } from 'vitest/node'
import type { ReportedHookContext, Reporter, TestCase, TestModule } from 'vitest/reporters'
import { sep } from 'node:path'
import { describe, expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'

describe('TestModule', () => {
  test('single test module', async () => {
    const report = await run({
      'test-module.test.ts': ts`
        test('example', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (test-module.test.ts)
      onTestModuleStart    (test-module.test.ts)
          onTestCaseReady  (test-module.test.ts) |example|
          onTestCaseResult (test-module.test.ts) |example|
      onTestModuleEnd      (test-module.test.ts)"
    `)
  })

  test('multiple test modules', async () => {
    const report = await run({
      'first.test.ts': ts`
        test('first test case', () => {});
      `,
      'second.test.ts': ts`
        test('second test case', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (first.test.ts)
      onTestModuleStart    (first.test.ts)
          onTestCaseReady  (first.test.ts) |first test case|
          onTestCaseResult (first.test.ts) |first test case|
      onTestModuleEnd      (first.test.ts)

      onTestModuleQueued   (second.test.ts)
      onTestModuleStart    (second.test.ts)
          onTestCaseReady  (second.test.ts) |second test case|
          onTestCaseResult (second.test.ts) |second test case|
      onTestModuleEnd      (second.test.ts)"
    `)
  })
})

describe('TestCase', () => {
  test('single test case', async () => {
    const report = await run({
      'example.test.ts': ts`
        test('single test case', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |single test case|
          onTestCaseResult (example.test.ts) |single test case|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('multiple test cases', async () => {
    const report = await run({
      'example.test.ts': ts`
        test('first', () => {});
        test('second', () => {});
        test('third', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |first|
          onTestCaseResult (example.test.ts) |first|

          onTestCaseReady  (example.test.ts) |second|
          onTestCaseResult (example.test.ts) |second|

          onTestCaseReady  (example.test.ts) |third|
          onTestCaseResult (example.test.ts) |third|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('skipped test case', async () => {
    const report = await run({
      'example.test.ts': ts`
        test('running', () => {});
        test.skip('skipped', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |skipped|
          onTestCaseResult (example.test.ts) |skipped|

          onTestCaseReady  (example.test.ts) |running|
          onTestCaseResult (example.test.ts) |running|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('skipped all test cases', async () => {
    const report = await run({
      'example.test.ts': ts`
        test.skip('first', () => {});
        test.skip('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |first|
          onTestCaseResult (example.test.ts) |first|

          onTestCaseReady  (example.test.ts) |second|
          onTestCaseResult (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })
})

describe('TestSuite', () => {
  test.todo('single test suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("example suite", () => {
          test('first test case', () => {});
        });
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('multiple test suites', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("first suite", () => {
          test('first test case', () => {});
        });

        describe("second suite", () => {
          test('second test case', () => {});
        });
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('nested test suites', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("first suite", () => {
          test('first test case', () => {});

          describe("second suite", () => {
            test('second test case', () => {});

            describe("third suite", () => {
              test('third test case', () => {});
            });
          });
        });
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('skipped test suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe.skip("skipped suite", () => {
          test('first test case', () => {});
        });
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('skipped nested test suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("first suite", () => {
          test('first test case', () => {});

            describe.skip("skipped suite", () => {
              test('second test case', () => {});
            });
        });
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })
})

describe('hooks', () => {
  test('beforeEach', async () => {
    const report = await run({
      'example.test.ts': ts`
        beforeEach(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |first|
              onHookStart  (example.test.ts) |first| [beforeEach]
              onHookEnd    (example.test.ts) |first| [beforeEach]
          onTestCaseResult (example.test.ts) |first|

          onTestCaseReady  (example.test.ts) |second|
              onHookStart  (example.test.ts) |second| [beforeEach]
              onHookEnd    (example.test.ts) |second| [beforeEach]
          onTestCaseResult (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('afterEach', async () => {
    const report = await run({
      'example.test.ts': ts`
        afterEach(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |first|
              onHookStart  (example.test.ts) |first| [afterEach]
              onHookEnd    (example.test.ts) |first| [afterEach]
          onTestCaseResult (example.test.ts) |first|

          onTestCaseReady  (example.test.ts) |second|
              onHookStart  (example.test.ts) |second| [afterEach]
              onHookEnd    (example.test.ts) |second| [afterEach]
          onTestCaseResult (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('beforeEach and afterEach', async () => {
    const report = await run({
      'example.test.ts': ts`
        beforeEach(() => {});
        afterEach(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
          onTestCaseReady  (example.test.ts) |first|
              onHookStart  (example.test.ts) |first| [beforeEach]
              onHookEnd    (example.test.ts) |first| [beforeEach]
              onHookStart  (example.test.ts) |first| [afterEach]
              onHookEnd    (example.test.ts) |first| [afterEach]
          onTestCaseResult (example.test.ts) |first|

          onTestCaseReady  (example.test.ts) |second|
              onHookStart  (example.test.ts) |second| [beforeEach]
              onHookEnd    (example.test.ts) |second| [beforeEach]
              onHookStart  (example.test.ts) |second| [afterEach]
              onHookEnd    (example.test.ts) |second| [afterEach]
          onTestCaseResult (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test.todo('beforeAll', async () => {
    const report = await run({
      'example.test.ts': ts`
        beforeAll(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('afterAll', async () => {
    const report = await run({
      'example.test.ts': ts`
        afterAll(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('beforeAll and afterAll', async () => {
    const report = await run({
      'example.test.ts': ts`
        beforeAll(() => {});
        afterAll(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('beforeAll on suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("example", () => {
          beforeAll(() => {});

          test('first', () => {});
          test('second', () => {});
        })
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })

  test.todo('afterAll on suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("example", () => {
          afterAll(() => {});

          test('first', () => {});
          test('second', () => {});
        })
      `,
    })

    expect(report).toMatchInlineSnapshot()
  })
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

  // Used to add newlines between test cases
  private callsTestCaseCount = 0

  onTestModuleQueued(module: TestModule) {
    this.calls.push(`onTestModuleQueued   (${normalizeFilename(module)})`)
  }

  onTestModuleStart(module: TestModule) {
    this.callsTestCaseCount = 0
    this.calls.push(`onTestModuleStart    (${normalizeFilename(module)})`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`onTestModuleEnd      (${normalizeFilename(module)})\n`)
  }

  onTestCaseReady(test: TestCase) {
    const separator = this.callsTestCaseCount > 0 ? '\n' : ''
    this.callsTestCaseCount++

    this.calls.push(`${separator}    onTestCaseReady  (${normalizeFilename(test.module)}) |${test.name}|`)
  }

  onTestCaseResult(test: TestCase) {
    this.calls.push(`    onTestCaseResult (${normalizeFilename(test.module)}) |${test.name}|`)
  }

  onHookStart(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    const padding = hook.entity.type === 'test' ? '        ' : '    '
    this.calls.push(`${`${padding}onHookStart`.padEnd(21)}(${normalizeFilename(module)})${name} [${hook.name}]`)
  }

  onHookEnd(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type === 'test' ? ` |${hook.entity.name}|` : ''
    const padding = hook.entity.type === 'test' ? '        ' : '    '
    this.calls.push(`${`${padding}onHookEnd`.padEnd(21)}(${normalizeFilename(module)})${name} [${hook.name}]`)
  }
}

function normalizeFilename(module: TestModule) {
  return module.moduleId
    .replace(module.project.config.root, '')
    .replaceAll(sep, '/')
    .substring(1)
}
