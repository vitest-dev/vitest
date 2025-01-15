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
import { rmSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { describe, expect, onTestFinished, test } from 'vitest'
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
        failed: true,
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
        failed: true,
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
        failed: true,
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
      onTestModuleQueued    (test-module.test.ts)
      onTestModuleCollected (test-module.test.ts)
      onTestModuleStart     (test-module.test.ts)
        onTestCaseReady     (test-module.test.ts) |example|
        onTestCaseResult    (test-module.test.ts) |example|
      onTestModuleEnd       (test-module.test.ts)"
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
      onTestModuleQueued    (first.test.ts)
      onTestModuleCollected (first.test.ts)
      onTestModuleStart     (first.test.ts)
        onTestCaseReady     (first.test.ts) |first test case|
        onTestCaseResult    (first.test.ts) |first test case|
      onTestModuleEnd       (first.test.ts)

      onTestModuleQueued    (second.test.ts)
      onTestModuleCollected (second.test.ts)
      onTestModuleStart     (second.test.ts)
        onTestCaseReady     (second.test.ts) |second test case|
        onTestCaseResult    (second.test.ts) |second test case|
      onTestModuleEnd       (second.test.ts)"
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
      onTestModuleQueued    (first.test.ts)
      onTestModuleCollected (first.test.ts)
      onTestModuleStart     (first.test.ts)
        onTestCaseReady     (first.test.ts) |first test case|
        onTestCaseResult    (first.test.ts) |first test case|
      onTestModuleEnd       (first.test.ts)

      onTestModuleQueued    (second.test.ts)
      onTestModuleCollected (second.test.ts)
      onTestModuleStart     (second.test.ts)
        onTestCaseReady     (second.test.ts) |second test case|
        onTestCaseResult    (second.test.ts) |second test case|
      onTestModuleEnd       (second.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |single test case|
        onTestCaseResult    (example.test.ts) |single test case|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
        onTestCaseResult    (example.test.ts) |second|
        onTestCaseReady     (example.test.ts) |third|
        onTestCaseResult    (example.test.ts) |third|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
        onTestCaseResult    (example.test.ts) |second|
        onTestCaseReady     (example.test.ts) |third|
        onTestCaseResult    (example.test.ts) |third|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |failing test case|
        onTestCaseResult    (example.test.ts) |failing test case|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |running|
        onTestCaseResult    (example.test.ts) |running|
        onTestCaseReady     (example.test.ts) |skipped|
        onTestCaseResult    (example.test.ts) |skipped|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |running|
        onTestCaseResult    (example.test.ts) |running|
        onTestCaseReady     (example.test.ts) |skipped|
        onTestCaseResult    (example.test.ts) |skipped|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
        onTestCaseResult    (example.test.ts) |second|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |example suite|
          onTestCaseReady   (example.test.ts) |first test case|
          onTestCaseResult  (example.test.ts) |first test case|
        onTestSuiteResult   (example.test.ts) |example suite|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |first suite|
          onTestCaseReady   (example.test.ts) |first test case|
          onTestCaseResult  (example.test.ts) |first test case|
        onTestSuiteResult   (example.test.ts) |first suite|
        onTestSuiteReady    (example.test.ts) |second suite|
          onTestCaseReady   (example.test.ts) |second test case|
          onTestCaseResult  (example.test.ts) |second test case|
        onTestSuiteResult   (example.test.ts) |second suite|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |first suite|
          onTestCaseReady   (example.test.ts) |first test case|
          onTestCaseResult  (example.test.ts) |first test case|
        onTestSuiteResult   (example.test.ts) |first suite|
        onTestSuiteReady    (example.test.ts) |second suite|
          onTestCaseReady   (example.test.ts) |second test case|
          onTestCaseResult  (example.test.ts) |second test case|
        onTestSuiteResult   (example.test.ts) |second suite|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |first suite|
          onTestCaseReady   (example.test.ts) |first test case|
          onTestCaseResult  (example.test.ts) |first test case|
          onTestSuiteReady  (example.test.ts) |second suite|
            onTestCaseReady (example.test.ts) |second test case|
            onTestCaseResult (example.test.ts) |second test case|
            onTestSuiteReady (example.test.ts) |third suite|
              onTestCaseReady (example.test.ts) |third test case|
              onTestCaseResult (example.test.ts) |third test case|
            onTestSuiteResult (example.test.ts) |third suite|
          onTestSuiteResult (example.test.ts) |second suite|
        onTestSuiteResult   (example.test.ts) |first suite|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |skipped suite|
          onTestCaseReady   (example.test.ts) |first test case|
          onTestCaseResult  (example.test.ts) |first test case|
        onTestSuiteResult   (example.test.ts) |skipped suite|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |skipped suite|
          onTestSuiteReady  (example.test.ts) |nested skipped suite|
            onTestCaseReady (example.test.ts) |first nested case|
            onTestCaseResult (example.test.ts) |first nested case|
          onTestSuiteResult (example.test.ts) |nested skipped suite|
        onTestSuiteResult   (example.test.ts) |skipped suite|
        onTestCaseReady     (example.test.ts) |first test case|
        onTestCaseResult    (example.test.ts) |first test case|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |first suite|
          onTestCaseReady   (example.test.ts) |first test case|
          onTestCaseResult  (example.test.ts) |first test case|
          onTestSuiteReady  (example.test.ts) |skipped suite|
            onTestCaseReady (example.test.ts) |second test case|
            onTestCaseResult (example.test.ts) |second test case|
          onTestSuiteResult (example.test.ts) |skipped suite|
        onTestSuiteResult   (example.test.ts) |first suite|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
          onHookStart       (example.test.ts) |first| [beforeEach]
          onHookEnd         (example.test.ts) |first| [beforeEach]
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
          onHookStart       (example.test.ts) |second| [beforeEach]
          onHookEnd         (example.test.ts) |second| [beforeEach]
        onTestCaseResult    (example.test.ts) |second|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
          onHookStart       (example.test.ts) |first| [afterEach]
          onHookEnd         (example.test.ts) |first| [afterEach]
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
          onHookStart       (example.test.ts) |second| [afterEach]
          onHookEnd         (example.test.ts) |second| [afterEach]
        onTestCaseResult    (example.test.ts) |second|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
          onHookStart       (example.test.ts) |first| [beforeEach]
          onHookEnd         (example.test.ts) |first| [beforeEach]
          onHookStart       (example.test.ts) |first| [afterEach]
          onHookEnd         (example.test.ts) |first| [afterEach]
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
          onHookStart       (example.test.ts) |second| [beforeEach]
          onHookEnd         (example.test.ts) |second| [beforeEach]
          onHookStart       (example.test.ts) |second| [afterEach]
          onHookEnd         (example.test.ts) |second| [afterEach]
        onTestCaseResult    (example.test.ts) |second|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onHookStart         (example.test.ts) [beforeAll]
        onHookEnd           (example.test.ts) [beforeAll]
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
        onTestCaseResult    (example.test.ts) |second|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
        onTestCaseResult    (example.test.ts) |second|
        onHookStart         (example.test.ts) [afterAll]
        onHookEnd           (example.test.ts) [afterAll]
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onHookStart         (example.test.ts) [beforeAll]
        onHookEnd           (example.test.ts) [beforeAll]
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
        onTestCaseResult    (example.test.ts) |second|
        onHookStart         (example.test.ts) [afterAll]
        onHookEnd           (example.test.ts) [afterAll]
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onHookStart         (example.test.ts) [beforeAll]
        onHookEnd           (example.test.ts) [beforeAll]
        onTestCaseReady     (example.test.ts) |first|
          onHookStart       (example.test.ts) |first| [beforeEach]
          onHookEnd         (example.test.ts) |first| [beforeEach]
          onHookStart       (example.test.ts) |first| [afterEach]
          onHookEnd         (example.test.ts) |first| [afterEach]
        onTestCaseResult    (example.test.ts) |first|
        onTestCaseReady     (example.test.ts) |second|
          onHookStart       (example.test.ts) |second| [beforeEach]
          onHookEnd         (example.test.ts) |second| [beforeEach]
          onHookStart       (example.test.ts) |second| [afterEach]
          onHookEnd         (example.test.ts) |second| [afterEach]
        onTestCaseResult    (example.test.ts) |second|
        onHookStart         (example.test.ts) [afterAll]
        onHookEnd           (example.test.ts) [afterAll]
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |example|
          onHookStart       (example.test.ts) |example| [beforeAll]
          onHookEnd         (example.test.ts) |example| [beforeAll]
          onTestCaseReady   (example.test.ts) |first|
          onTestCaseResult  (example.test.ts) |first|
          onTestCaseReady   (example.test.ts) |second|
          onTestCaseResult  (example.test.ts) |second|
        onTestSuiteResult   (example.test.ts) |example|
      onTestModuleEnd       (example.test.ts)"
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
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestSuiteReady    (example.test.ts) |example|
          onTestCaseReady   (example.test.ts) |first|
          onTestCaseResult  (example.test.ts) |first|
          onTestCaseReady   (example.test.ts) |second|
          onTestCaseResult  (example.test.ts) |second|
          onHookStart       (example.test.ts) |example| [afterAll]
          onHookEnd         (example.test.ts) |example| [afterAll]
        onTestSuiteResult   (example.test.ts) |example|
      onTestModuleEnd       (example.test.ts)"
    `)
  })
})

describe('merge reports', () => {
  test('correctly reports events for a single test module', async () => {
    const blobsOutputDirectory = resolve(import.meta.dirname, 'fixtures-blobs')
    const blobOutputFile = resolve(blobsOutputDirectory, 'blob.json')
    onTestFinished(() => {
      rmSync(blobOutputFile)
    })

    const { root } = await runInlineTests({
      'example.test.ts': ts`
        test('first', () => {});
        describe('suite', () => {
          test('second', () => {});
        });
      `,
    }, {
      globals: true,
      reporters: [['blob', { outputFile: blobOutputFile }]],
    })

    const report = await run(
      {},
      {
        mergeReports: blobsOutputDirectory,
      },
      {
        roots: [root],
      },
    )

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued    (example.test.ts)
      onTestModuleCollected (example.test.ts)
      onTestModuleStart     (example.test.ts)
        onTestCaseReady     (example.test.ts) |first|
        onTestCaseResult    (example.test.ts) |first|
        onTestSuiteReady    (example.test.ts) |suite|
          onTestCaseReady   (example.test.ts) |second|
          onTestCaseResult  (example.test.ts) |second|
        onTestSuiteResult   (example.test.ts) |suite|
      onTestModuleEnd       (example.test.ts)"
    `)
  })

  test('correctly reports multiple test modules', async () => {
    const blobsOutputDirectory = resolve(import.meta.dirname, 'fixtures-blobs')
    const blobOutputFile1 = resolve(blobsOutputDirectory, 'blob-1.json')
    const blobOutputFile2 = resolve(blobsOutputDirectory, 'blob-2.json')
    onTestFinished(() => {
      rmSync(blobOutputFile1)
      rmSync(blobOutputFile2)
    })

    const { root: root1 } = await runInlineTests({
      'example-1.test.ts': ts`
        test('first', () => {});
        describe('suite', () => {
          test('second', () => {});
        });
      `,
    }, {
      globals: true,
      reporters: [['blob', { outputFile: blobOutputFile1 }]],
    })

    const { root: root2 } = await runInlineTests({
      'example-2.test.ts': ts`
        test('first', () => {});
        describe.skip('suite', () => {
          test('second', () => {});
          test('third', () => {});
        });
        test.skip('fourth', () => {});
        test('fifth', () => {});
        `,
    }, {
      globals: true,
      reporters: [['blob', { outputFile: blobOutputFile2 }]],
    })

    const report = await run({}, {
      mergeReports: blobsOutputDirectory,
    }, {
      roots: [root1, root2],
    })

    expect(report).toMatchInlineSnapshot(`
      "
      onTestModuleQueued    (example-1.test.ts)
      onTestModuleCollected (example-1.test.ts)
      onTestModuleStart     (example-1.test.ts)
        onTestCaseReady     (example-1.test.ts) |first|
        onTestCaseResult    (example-1.test.ts) |first|
        onTestSuiteReady    (example-1.test.ts) |suite|
          onTestCaseReady   (example-1.test.ts) |second|
          onTestCaseResult  (example-1.test.ts) |second|
        onTestSuiteResult   (example-1.test.ts) |suite|
      onTestModuleEnd       (example-1.test.ts)

      onTestModuleQueued    (example-2.test.ts)
      onTestModuleCollected (example-2.test.ts)
      onTestModuleStart     (example-2.test.ts)
        onTestCaseReady     (example-2.test.ts) |first|
        onTestCaseResult    (example-2.test.ts) |first|
        onTestSuiteReady    (example-2.test.ts) |suite|
          onTestCaseReady   (example-2.test.ts) |second|
          onTestCaseResult  (example-2.test.ts) |second|
          onTestCaseReady   (example-2.test.ts) |third|
          onTestCaseResult  (example-2.test.ts) |third|
        onTestSuiteResult   (example-2.test.ts) |suite|
        onTestCaseReady     (example-2.test.ts) |fifth|
        onTestCaseResult    (example-2.test.ts) |fifth|
        onTestCaseReady     (example-2.test.ts) |fourth|
        onTestCaseResult    (example-2.test.ts) |fourth|
      onTestModuleEnd       (example-2.test.ts)"
    `)
  })
})

describe('type checking', () => {
  test('typechking is reported correctly', async () => {
    const report = await run({
      'example-1.test-d.ts': ts`
        test('first', () => {});
        describe('suite', () => {
          test('second', () => {});
        });
      `,
      'example-2.test-d.ts': ts`
        test('first', () => {});
        describe.skip('suite', () => {
          test('second', () => {});
          test('third', () => {});
        });
        test.skip('fourth', () => {});
        test('fifth', () => {});
      `,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
        },
        include: ['./*.test-d.ts'],
      }),
    }, {
      typecheck: {
        enabled: true,
      },
    }, { printTestRunEvents: true })

    // NOTE: typechecker reports test modules in bulk, so the order of queued and collect
    // is different from the normal test run, this is because the typechecker runs everything together
    // this _might_ need to be changed in the future
    expect(report).toMatchInlineSnapshot(`
      "
      onTestRunStart (2 specifications)
      onTestModuleQueued    (example-1.test-d.ts)
      onTestModuleQueued    (example-2.test-d.ts)
      onTestModuleCollected (example-1.test-d.ts)
      onTestModuleCollected (example-2.test-d.ts)
      onTestModuleStart     (example-1.test-d.ts)
        onTestCaseReady     (example-1.test-d.ts) |first|
        onTestCaseResult    (example-1.test-d.ts) |first|
        onTestSuiteReady    (example-1.test-d.ts) |suite|
          onTestCaseReady   (example-1.test-d.ts) |second|
          onTestCaseResult  (example-1.test-d.ts) |second|
        onTestSuiteResult   (example-1.test-d.ts) |suite|
      onTestModuleEnd       (example-1.test-d.ts)

      onTestModuleStart     (example-2.test-d.ts)
        onTestCaseReady     (example-2.test-d.ts) |first|
        onTestCaseResult    (example-2.test-d.ts) |first|
        onTestSuiteReady    (example-2.test-d.ts) |suite|
          onTestCaseReady   (example-2.test-d.ts) |second|
          onTestCaseResult  (example-2.test-d.ts) |second|
          onTestCaseReady   (example-2.test-d.ts) |third|
          onTestCaseResult  (example-2.test-d.ts) |third|
        onTestSuiteResult   (example-2.test-d.ts) |suite|
        onTestCaseReady     (example-2.test-d.ts) |fifth|
        onTestCaseResult    (example-2.test-d.ts) |fifth|
        onTestCaseReady     (example-2.test-d.ts) |fourth|
        onTestCaseResult    (example-2.test-d.ts) |fourth|
      onTestModuleEnd       (example-2.test-d.ts)

      onTestRunEnd   (failed, 2 modules, 0 errors)"
    `)
  })
})

interface ReporterOptions {
  printTestRunEvents?: boolean
  roots?: string[]
  failed?: boolean
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

  if (!reporterOptions?.printTestRunEvents && !reporterOptions?.failed) {
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
    this.calls.push(`onTestModuleQueued    (${this.normalizeFilename(module)})`)
  }

  onTestModuleCollected(module: TestModule) {
    this.calls.push(`onTestModuleCollected (${this.normalizeFilename(module)})`)
  }

  onTestSuiteReady(testSuite: TestSuite) {
    this.calls.push(`${padded(testSuite, 'onTestSuiteReady')} (${this.normalizeFilename(testSuite.module)}) |${testSuite.name}|`)
  }

  onTestSuiteResult(testSuite: TestSuite) {
    this.calls.push(`${padded(testSuite, 'onTestSuiteResult')} (${this.normalizeFilename(testSuite.module)}) |${testSuite.name}|`)
  }

  onTestModuleStart(module: TestModule) {
    this.calls.push(`onTestModuleStart     (${this.normalizeFilename(module)})`)
  }

  onTestModuleEnd(module: TestModule) {
    this.calls.push(`onTestModuleEnd       (${this.normalizeFilename(module)})\n`)
  }

  onTestCaseReady(test: TestCase) {
    this.calls.push(`${padded(test, 'onTestCaseReady')} (${this.normalizeFilename(test.module)}) |${test.name}|`)
  }

  onTestCaseResult(test: TestCase) {
    this.calls.push(`${padded(test, 'onTestCaseResult')} (${this.normalizeFilename(test.module)}) |${test.name}|`)
  }

  onHookStart(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type !== 'module' ? ` |${hook.entity.name}|` : ''
    this.calls.push(`  ${padded(hook.entity, 'onHookStart', 19)} (${this.normalizeFilename(module)})${name} [${hook.name}]`)
  }

  onHookEnd(hook: ReportedHookContext) {
    const module = hook.entity.type === 'module' ? hook.entity : hook.entity.module
    const name = hook.entity.type !== 'module' ? ` |${hook.entity.name}|` : ''
    this.calls.push(`  ${padded(hook.entity, 'onHookEnd', 19)} (${this.normalizeFilename(module)})${name} [${hook.name}]`)
  }

  normalizeFilename(module: TestModule) {
    return normalizeFilename(module, this.options.roots)
  }
}

function normalizeFilename(module: TestModule, roots?: string[]) {
  const relative = (roots || [module.project.config.root]).reduce((acc, root) => {
    return acc.replace(root, '')
  }, module.moduleId)
  return relative.replaceAll(sep, '/')
    .substring(1)
}

function padded(entity: TestSuite | TestCase | TestModule, name: string, pad = 21) {
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
