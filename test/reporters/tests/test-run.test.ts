import type {
  ReportedHookContext,
  Reporter,
  SerializedError,
  TestCase,
  TestModule,
  TestRunEndReason,
  TestSpecification,
  TestSuite,
  UserConfig,
} from 'vitest/node'
import { sep } from 'node:path'
import { describe, expect, test } from 'vitest'
import { runInlineTests, ts } from '../../test-utils'

describe('TestRun', () => {
  test('pass test run without files (no-watch)', async () => {
    const report = await run(
      {},
      {
        passWithNoTests: true,
        watch: false,
      },
      {
        printTestRunEvents: true,
      },
    )

    expect(report).toMatchInlineSnapshot(`
      "
      onTestRunStart (0 specifications)
      onTestRunEnd   (passed, 0 modules, 0 errors)"
    `)
  })

  test('pass test run without files (watch)', async () => {
    const report = await run(
      {},
      {
        passWithNoTests: true,
        watch: true,
      },
      {
        printTestRunEvents: true,
      },
    )

    expect(report).toMatchInlineSnapshot(`
      "
      onTestRunStart (0 specifications)
      onTestRunEnd   (passed, 0 modules, 0 errors)"
    `)
  })

  test('fail test run without files (no-watch)', async () => {
    const report = await run(
      {},
      {
        passWithNoTests: false,
        watch: false,
      },
      {
        printTestRunEvents: true,
      },
    )

    expect(report).toMatchInlineSnapshot(`
      "
      onTestRunStart (0 specifications)
      onTestRunEnd   (failed, 0 modules, 0 errors)"
    `)
  })
})

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
        onTestCaseReady    (test-module.test.ts) |example|
        onTestCaseResult   (test-module.test.ts) |example|
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
        onTestCaseReady    (first.test.ts) |first test case|
        onTestCaseResult   (first.test.ts) |first test case|
      onTestModuleEnd      (first.test.ts)

      onTestModuleQueued   (second.test.ts)
      onTestModuleStart    (second.test.ts)
        onTestCaseReady    (second.test.ts) |second test case|
        onTestCaseResult   (second.test.ts) |second test case|
      onTestModuleEnd      (second.test.ts)"
    `)
  })

  test('test modules with delay', async () => {
    const report = await run({
      'first.test.ts': ts`
        ${delay()}
        test('first test case', async () => { ${delay()} });
      `,
      'second.test.ts': ts`
      ${delay()}
      test('second test case', async () => { ${delay()} });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (first.test.ts)
      onTestModuleStart    (first.test.ts)
        onTestCaseReady    (first.test.ts) |first test case|
        onTestCaseResult   (first.test.ts) |first test case|
      onTestModuleEnd      (first.test.ts)

      onTestModuleQueued   (second.test.ts)
      onTestModuleStart    (second.test.ts)
        onTestCaseReady    (second.test.ts) |second test case|
        onTestCaseResult   (second.test.ts) |second test case|
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
        onTestCaseReady    (example.test.ts) |single test case|
        onTestCaseResult   (example.test.ts) |single test case|
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
        onTestCaseReady    (example.test.ts) |first|
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
        onTestCaseResult   (example.test.ts) |second|
        onTestCaseReady    (example.test.ts) |third|
        onTestCaseResult   (example.test.ts) |third|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('multiple test cases with delay', async () => {
    const report = await run({
      'example.test.ts': ts`
        ${delay()}
        test('first', async () => { ${delay()} });
        test('second', async () => { ${delay()} });
        test('third', async () => { ${delay()} });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestCaseReady    (example.test.ts) |first|
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
        onTestCaseResult   (example.test.ts) |second|
        onTestCaseReady    (example.test.ts) |third|
        onTestCaseResult   (example.test.ts) |third|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('failing test case', async () => {
    const report = await run({
      'example.test.ts': ts`
        test('failing test case', () => {
          expect(1).toBe(2)
        });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestCaseReady    (example.test.ts) |failing test case|
        onTestCaseResult   (example.test.ts) |failing test case|
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
        onTestCaseReady    (example.test.ts) |running|
        onTestCaseResult   (example.test.ts) |running|
        onTestCaseReady    (example.test.ts) |skipped|
        onTestCaseResult   (example.test.ts) |skipped|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('dynamically skipped test case', async () => {
    const report = await run({
      'example.test.ts': ts`
        test('running', () => {});
        test('skipped', (ctx) => { ctx.skip() });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestCaseReady    (example.test.ts) |running|
        onTestCaseResult   (example.test.ts) |running|
        onTestCaseReady    (example.test.ts) |skipped|
        onTestCaseResult   (example.test.ts) |skipped|
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
        onTestCaseReady    (example.test.ts) |first|
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
        onTestCaseResult   (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })
})

describe('TestSuite', () => {
  test('single test suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("example suite", () => {
          test('first test case', () => {});
        });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |example suite|
          onTestCaseReady  (example.test.ts) |first test case|
          onTestCaseResult (example.test.ts) |first test case|
        onTestSuiteResult  (example.test.ts) |example suite|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('multiple test suites', async () => {
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

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |first suite|
          onTestCaseReady  (example.test.ts) |first test case|
          onTestCaseResult (example.test.ts) |first test case|
        onTestSuiteResult  (example.test.ts) |first suite|
        onTestSuiteReady   (example.test.ts) |second suite|
          onTestCaseReady  (example.test.ts) |second test case|
          onTestCaseResult (example.test.ts) |second test case|
        onTestSuiteResult  (example.test.ts) |second suite|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('multiple test suites with delay', async () => {
    const report = await run({
      'example.test.ts': ts`
        ${delay()}
        describe("first suite", async () => {
          ${delay()}
          test('first test case', async () => { ${delay()} });
        });

        describe("second suite", async () => {
          ${delay()}
          test('second test case', async () => { ${delay()} });
        });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |first suite|
          onTestCaseReady  (example.test.ts) |first test case|
          onTestCaseResult (example.test.ts) |first test case|
        onTestSuiteResult  (example.test.ts) |first suite|
        onTestSuiteReady   (example.test.ts) |second suite|
          onTestCaseReady  (example.test.ts) |second test case|
          onTestCaseResult (example.test.ts) |second test case|
        onTestSuiteResult  (example.test.ts) |second suite|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('nested test suites', async () => {
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

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |first suite|
          onTestCaseReady  (example.test.ts) |first test case|
          onTestCaseResult (example.test.ts) |first test case|
          onTestSuiteReady (example.test.ts) |second suite|
            onTestCaseReady (example.test.ts) |second test case|
            onTestCaseResult (example.test.ts) |second test case|
            onTestSuiteReady (example.test.ts) |third suite|
              onTestCaseReady (example.test.ts) |third test case|
              onTestCaseResult (example.test.ts) |third test case|
            onTestSuiteResult (example.test.ts) |third suite|
          onTestSuiteResult (example.test.ts) |second suite|
        onTestSuiteResult  (example.test.ts) |first suite|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('skipped test suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe.skip("skipped suite", () => {
          test('first test case', () => {});
        });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |skipped suite|
          onTestCaseReady  (example.test.ts) |first test case|
          onTestCaseResult (example.test.ts) |first test case|
        onTestSuiteResult  (example.test.ts) |skipped suite|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('skipped double nested test suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe.skip("skipped suite", () => {
          describe.skip("nested skipped suite", () => {
            test('first nested case', () => {});
          })
        });

        test('first test case', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |skipped suite|
          onTestSuiteReady (example.test.ts) |nested skipped suite|
            onTestCaseReady (example.test.ts) |first nested case|
            onTestCaseResult (example.test.ts) |first nested case|
          onTestSuiteResult (example.test.ts) |nested skipped suite|
        onTestSuiteResult  (example.test.ts) |skipped suite|
        onTestCaseReady    (example.test.ts) |first test case|
        onTestCaseResult   (example.test.ts) |first test case|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('skipped nested test suite', async () => {
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

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |first suite|
          onTestCaseReady  (example.test.ts) |first test case|
          onTestCaseResult (example.test.ts) |first test case|
          onTestSuiteReady (example.test.ts) |skipped suite|
            onTestCaseReady (example.test.ts) |second test case|
            onTestCaseResult (example.test.ts) |second test case|
          onTestSuiteResult (example.test.ts) |skipped suite|
        onTestSuiteResult  (example.test.ts) |first suite|
      onTestModuleEnd      (example.test.ts)"
    `)
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
        onTestCaseReady    (example.test.ts) |first|
          onHookStart      (example.test.ts) |first| [beforeEach]
          onHookEnd        (example.test.ts) |first| [beforeEach]
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
          onHookStart      (example.test.ts) |second| [beforeEach]
          onHookEnd        (example.test.ts) |second| [beforeEach]
        onTestCaseResult   (example.test.ts) |second|
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
        onTestCaseReady    (example.test.ts) |first|
          onHookStart      (example.test.ts) |first| [afterEach]
          onHookEnd        (example.test.ts) |first| [afterEach]
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
          onHookStart      (example.test.ts) |second| [afterEach]
          onHookEnd        (example.test.ts) |second| [afterEach]
        onTestCaseResult   (example.test.ts) |second|
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
        onTestCaseReady    (example.test.ts) |first|
          onHookStart      (example.test.ts) |first| [beforeEach]
          onHookEnd        (example.test.ts) |first| [beforeEach]
          onHookStart      (example.test.ts) |first| [afterEach]
          onHookEnd        (example.test.ts) |first| [afterEach]
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
          onHookStart      (example.test.ts) |second| [beforeEach]
          onHookEnd        (example.test.ts) |second| [beforeEach]
          onHookStart      (example.test.ts) |second| [afterEach]
          onHookEnd        (example.test.ts) |second| [afterEach]
        onTestCaseResult   (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('beforeAll', async () => {
    const report = await run({
      'example.test.ts': ts`
        beforeAll(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onHookStart        (example.test.ts) [beforeAll]
        onHookEnd          (example.test.ts) [beforeAll]
        onTestCaseReady    (example.test.ts) |first|
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
        onTestCaseResult   (example.test.ts) |second|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('afterAll', async () => {
    const report = await run({
      'example.test.ts': ts`
        afterAll(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestCaseReady    (example.test.ts) |first|
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
        onTestCaseResult   (example.test.ts) |second|
        onHookStart        (example.test.ts) [afterAll]
        onHookEnd          (example.test.ts) [afterAll]
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('beforeAll and afterAll', async () => {
    const report = await run({
      'example.test.ts': ts`
        beforeAll(() => {});
        afterAll(() => {});

        test('first', () => {});
        test('second', () => {});
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onHookStart        (example.test.ts) [beforeAll]
        onHookEnd          (example.test.ts) [beforeAll]
        onTestCaseReady    (example.test.ts) |first|
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
        onTestCaseResult   (example.test.ts) |second|
        onHookStart        (example.test.ts) [afterAll]
        onHookEnd          (example.test.ts) [afterAll]
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('all hooks with delay', async () => {
    const report = await run({
      'example.test.ts': ts`
        ${delay()}
        beforeAll(async () => { ${delay()} });
        afterAll(async () => { ${delay()} });
        beforeEach(async () => { ${delay()} });
        afterEach(async () => { ${delay()} });

        test('first', async () => { ${delay()} });
        test('second', async () => { ${delay()} });
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onHookStart        (example.test.ts) [beforeAll]
        onHookEnd          (example.test.ts) [beforeAll]
        onTestCaseReady    (example.test.ts) |first|
          onHookStart      (example.test.ts) |first| [beforeEach]
          onHookEnd        (example.test.ts) |first| [beforeEach]
          onHookStart      (example.test.ts) |first| [afterEach]
          onHookEnd        (example.test.ts) |first| [afterEach]
        onTestCaseResult   (example.test.ts) |first|
        onTestCaseReady    (example.test.ts) |second|
          onHookStart      (example.test.ts) |second| [beforeEach]
          onHookEnd        (example.test.ts) |second| [beforeEach]
          onHookStart      (example.test.ts) |second| [afterEach]
          onHookEnd        (example.test.ts) |second| [afterEach]
        onTestCaseResult   (example.test.ts) |second|
        onHookStart        (example.test.ts) [afterAll]
        onHookEnd          (example.test.ts) [afterAll]
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('beforeAll on suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("example", () => {
          beforeAll(() => {});

          test('first', () => {});
          test('second', () => {});
        })
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |example|
          onHookStart      (example.test.ts) |example| [beforeAll]
          onHookEnd        (example.test.ts) |example| [beforeAll]
          onTestCaseReady  (example.test.ts) |first|
          onTestCaseResult (example.test.ts) |first|
          onTestCaseReady  (example.test.ts) |second|
          onTestCaseResult (example.test.ts) |second|
        onTestSuiteResult  (example.test.ts) |example|
      onTestModuleEnd      (example.test.ts)"
    `)
  })

  test('afterAll on suite', async () => {
    const report = await run({
      'example.test.ts': ts`
        describe("example", () => {
          afterAll(() => {});

          test('first', () => {});
          test('second', () => {});
        })
      `,
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued   (example.test.ts)
      onTestModuleStart    (example.test.ts)
        onTestSuiteReady   (example.test.ts) |example|
          onTestCaseReady  (example.test.ts) |first|
          onTestCaseResult (example.test.ts) |first|
          onTestCaseReady  (example.test.ts) |second|
          onTestCaseResult (example.test.ts) |second|
          onHookStart      (example.test.ts) |example| [afterAll]
          onHookEnd        (example.test.ts) |example| [afterAll]
        onTestSuiteResult  (example.test.ts) |example|
      onTestModuleEnd      (example.test.ts)"
    `)
  })
})

interface ReporterOptions {
  printTestRunEvents?: boolean
}

async function run(
  structure: Parameters<typeof runInlineTests>[0],
  customConfig?: UserConfig,
  reporterOptions?: ReporterOptions,
) {
  const reporter = new CustomReporter(reporterOptions)

  const config: UserConfig = {
    config: false,
    fileParallelism: false,
    globals: true,
    reporters: [reporter],
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
    ...customConfig,
  }

  const { stdout, stderr } = await runInlineTests(structure, config)

  if (reporterOptions?.printTestRunEvents) {
    if (config.passWithNoTests) {
      expect(stdout).toContain('No test files found, exiting with code 0')
    }
    else {
      expect(stderr).toContain('No test files found, exiting with code 1')
    }
  }
  else {
    expect(stdout).toBe('')
    expect(stderr).toBe('')
  }

  return `\n${reporter.calls.join('\n').trim()}`
}

class CustomReporter implements Reporter {
  calls: string[] = []

  constructor(private options: ReporterOptions = {}) {}

  onTestRunStart(specifications: ReadonlyArray<TestSpecification>) {
    if (this.options.printTestRunEvents) {
      this.calls.push(`onTestRunStart (${specifications.length} specifications)`)
    }
  }

  onTestRunEnd(modules: ReadonlyArray<TestModule>, errors: ReadonlyArray<SerializedError>, state: TestRunEndReason) {
    if (this.options.printTestRunEvents) {
      this.calls.push(`onTestRunEnd   (${state}, ${modules.length} modules, ${errors.length} errors)`)
    }
  }

  onTestModuleQueued(module: TestModule) {
    this.calls.push(`onTestModuleQueued   (${normalizeFilename(module)})`)
  }

  onTestSuiteReady(testSuite: TestSuite) {
    this.calls.push(`${padded(testSuite, 'onTestSuiteReady')} (${normalizeFilename(testSuite.module)}) |${testSuite.name}|`)
  }

  onTestSuiteResult(testSuite: TestSuite) {
    this.calls.push(`${padded(testSuite, 'onTestSuiteResult')} (${normalizeFilename(testSuite.module)}) |${testSuite.name}|`)
  }

  onTestModuleStart(module: TestModule) {
    this.calls.push(`onTestModuleStart    (${normalizeFilename(module)})`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`onTestModuleEnd      (${normalizeFilename(module)})\n`)
  }

  onTestCaseReady(test: TestCase) {
    this.calls.push(`${padded(test, 'onTestCaseReady')} (${normalizeFilename(test.module)}) |${test.name}|`)
  }

  onTestCaseResult(test: TestCase) {
    this.calls.push(`${padded(test, 'onTestCaseResult')} (${normalizeFilename(test.module)}) |${test.name}|`)
  }

  onHookStart(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type !== 'module' ? ` |${hook.entity.name}|` : ''
    this.calls.push(`  ${padded(hook.entity, 'onHookStart', 18)} (${normalizeFilename(module)})${name} [${hook.name}]`)
  }

  onHookEnd(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type !== 'module' ? ` |${hook.entity.name}|` : ''
    this.calls.push(`  ${padded(hook.entity, 'onHookEnd', 18)} (${normalizeFilename(module)})${name} [${hook.name}]`)
  }
}

function normalizeFilename(module: TestModule) {
  return module.moduleId
    .replace(module.project.config.root, '')
    .replaceAll(sep, '/')
    .substring(1)
}

function padded(entity: TestSuite | TestCase | TestModule, name: string, pad = 20) {
  return (' '.repeat(getDepth(entity)) + name).padEnd(pad)
}

function getDepth(entity: TestSuite | TestCase | TestModule) {
  if (entity.type === 'module') {
    return 0
  }

  let depth = 0
  let parent = entity.parent

  while (parent) {
    depth += 2
    if (parent.type !== 'module') {
      parent = parent.parent
    }
    else {
      break
    }
  }

  return depth
}

function delay() {
  return `await new Promise(resolve => setTimeout(resolve, 100));`
}
