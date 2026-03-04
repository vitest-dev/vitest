# Reporters

::: warning
This is an advanced API. If you just want to configure built-in reporters, read the ["Reporters"](/guide/reporters) guide.
:::

Vitest has its own test run lifecycle. These are represented by reporter's methods:

- [`onInit`](#oninit)
- [`onTestRunStart`](#ontestrunstart)
  - [`onTestModuleQueued`](#ontestmodulequeued)
  - [`onTestModuleCollected`](#ontestmodulecollected)
  - [`onTestModuleStart`](#ontestmodulestart)
    - [`onTestSuiteReady`](#ontestsuiteready)
      - [`onHookStart(beforeAll)`](#onhookstart)
      - [`onHookEnd(beforeAll)`](#onhookend)
        - [`onTestCaseReady`](#ontestcaseready)
          - [`onTestCaseAnnotate`](#ontestcaseannotate) <Version>3.2.0</Version>
          - [`onTestCaseArtifactRecord`](#ontestcaseartifactrecord) <Version type="experimental">4.0.11</Version>
          - [`onHookStart(beforeEach)`](#onhookstart)
          - [`onHookEnd(beforeEach)`](#onhookend)
          - [`onHookStart(afterEach)`](#onhookstart)
          - [`onHookEnd(afterEach)`](#onhookend)
        - [`onTestCaseResult`](#ontestcaseresult)
      - [`onHookStart(afterAll)`](#onhookstart)
      - [`onHookEnd(afterAll)`](#onhookend)
    - [`onTestSuiteResult`](#ontestsuiteresult)
  - [`onTestModuleEnd`](#ontestmoduleend)
  - [`onCoverage`](#oncoverage)
- [`onTestRunEnd`](#ontestrunend)

Tests and suites within a single module will be reported in order unless they were skipped. All skipped tests are reported at the end of suite/module.

Note that since test modules can run in parallel, Vitest will report them in parallel.

This guide lists all supported reporter methods. However, don't forget that instead of creating your own reporter, you can [extend existing one](/guide/advanced/reporters) instead:

```ts [custom-reporter.js]
import { BaseReporter } from 'vitest/node'

export default class CustomReporter extends BaseReporter {
  onTestRunEnd(testModules, errors) {
    console.log(testModule.length, 'tests finished running')
    super.onTestRunEnd(testModules, errors)
  }
}
```

## onInit

```ts
function onInit(vitest: Vitest): Awaitable<void>
```

This method is called when [Vitest](/api/advanced/vitest) was initiated or started, but before the tests were filtered.

::: info
Internally this method is called inside [`vitest.start`](/api/advanced/vitest#start), [`vitest.init`](/api/advanced/vitest#init) or [`vitest.mergeReports`](/api/advanced/vitest#mergereports). If you are using programmatic API, make sure to call either one depending on your needs before calling [`vitest.runTestSpecifications`](/api/advanced/vitest#runtestspecifications), for example. Built-in CLI will always run methods in correct order.
:::

Note that you can also get access to `vitest` instance from test cases, suites and test modules via a [`project`](/api/advanced/test-project) property, but it might also be useful to store a reference to `vitest` in this method.

::: details Example
```ts
import type { Reporter, TestSpecification, Vitest } from 'vitest/node'

class MyReporter implements Reporter {
  private vitest!: Vitest

  onInit(vitest: Vitest) {
    this.vitest = vitest
  }

  onTestRunStart(specifications: TestSpecification[]) {
    console.log(
      specifications.length,
      'test files will run in',
      this.vitest.config.root,
    )
  }
}

export default new MyReporter()
```
:::

## onBrowserInit {#onbrowserinit}

```ts
function onBrowserInit(project: TestProject): Awaitable<void>
```

This method is called when the browser instance is initiated. It receives an instance of the project for which the browser is initiated. `project.browser` will always be defined when this method is called.

## onTestRunStart

```ts
function onTestRunStart(
  specifications: TestSpecification[]
): Awaitable<void>
```

This method is called when a new test run has started. It receives an array of [test specifications](/api/advanced/test-specification) scheduled to run. This array is readonly and available only for information purposes.

If Vitest didn't find any test files to run, this event will be invoked with an empty array, and then [`onTestRunEnd`](#ontestrunend) will be called immediately after.

::: details Example
```ts
import type { Reporter, TestSpecification } from 'vitest/node'

class MyReporter implements Reporter {
  onTestRunStart(specifications: TestSpecification[]) {
    console.log(specifications.length, 'test files will run')
  }
}

export default new MyReporter()
```
:::

## onTestRunEnd

```ts
function onTestRunEnd(
  testModules: ReadonlyArray<TestModule>,
  unhandledErrors: ReadonlyArray<SerializedError>,
  reason: TestRunEndReason
): Awaitable<void>
```

This method is called after all tests have finished running and the coverage merged all reports, if it's enabled. Note that you can get the coverage information in [`onCoverage`](#oncoverage) hook.

It receives a readonly list of test modules. You can iterate over it via a [`testModule.children`](/api/advanced/test-collection) property to report the state and errors, if any.

The second argument is a readonly list of unhandled errors that Vitest wasn't able to attribute to any test. These can happen outside of the test run because of an error in a plugin, or inside the test run as a side-effect of a non-awaited function (for example, a timeout that threw an error after the test has finished running).

The third argument indicated why the test run was finished:

- `passed`: test run was finished normally and there are no errors
- `failed`: test run has at least one error (due to a syntax error during collection or an actual error during test execution)
- `interrupted`: test was interrupted by [`vitest.cancelCurrentRun`](/api/advanced/vitest#cancelcurrentrun) call or `Ctrl+C` was pressed in the terminal (note that it's still possible to have failed tests in this case)

If Vitest didn't find any test files to run, this event will be invoked with empty arrays of modules and errors, and the state will depend on the value of [`config.passWithNoTests`](/config/passwithnotests).

::: details Example
```ts
import type {
  Reporter,
  SerializedError,
  TestModule,
  TestRunEndReason,
  TestSpecification
} from 'vitest/node'

class MyReporter implements Reporter {
  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: TestRunEndReason,
  ) {
    if (reason === 'passed') {
      testModules.forEach(module => console.log(module.moduleId, 'succeeded'))
    }
    else if (reason === 'failed') {
      // note that this will skip possible errors in suites
      // you can get them from testSuite.errors()
      for (const testCase of testModules.children.allTests()) {
        if (testCase.result().state === 'failed') {
          console.log(testCase.fullName, 'in', testCase.module.moduleId, 'failed')
          console.log(testCase.result().errors)
        }
      }
    }
    else {
      console.log('test run was interrupted, skipping report')
    }
  }
}

export default new MyReporter()
```
:::

## onCoverage

```ts
function onCoverage(coverage: unknown): Awaitable<void>
```

This hook is called after coverage results have been processed. Coverage provider's reporters are called after this hook. The typings of `coverage` depends on the `coverage.provider`. For Vitest's default built-in providers you can import the types from `istanbul-lib-coverage` package:

```ts
import type { CoverageMap } from 'istanbul-lib-coverage'

declare function onCoverage(coverage: CoverageMap): Awaitable<void>
```

If Vitest didn't perform any coverage, this hook is not called.

## onTestModuleQueued

```ts
function onTestModuleQueued(testModule: TestModule): Awaitable<void>
```

This method is called right before Vitest imports the setup file and the test module itself. This means that `testModule` will have no [`children`](/api/advanced/test-suite#children) yet, but you can start reporting it as the next test to run.

## onTestModuleCollected

```ts
function onTestModuleCollected(testModule: TestModule): Awaitable<void>
```

This method is called when all tests inside the file were collected, meaning [`testModule.children`](/api/advanced/test-suite#children) collection is populated, but tests don't have any results yet.

## onTestModuleStart

```ts
function onTestModuleStart(testModule: TestModule): Awaitable<void>
```

This method is called right after [`onTestModuleCollected`](#ontestmodulecollected) unless Vitest runs in collection mode ([`vitest.collect()`](/api/advanced/vitest#collect) or `vitest collect` in the CLI), in this case it will not be called at all because there are no tests to run.

## onTestModuleEnd

```ts
function onTestModuleEnd(testModule: TestModule): Awaitable<void>
```

This method is called when every test in the module finished running. This means, every test inside [`testModule.children`](/api/advanced/test-suite#children) will have a `test.result()` that is not equal to `pending`.

## onHookStart

```ts
function onHookStart(context: ReportedHookContext): Awaitable<void>
```

This method is called when any of these hooks have started running:

- `beforeAll`
- `afterAll`
- `beforeEach`
- `afterEach`

If `beforeAll` or `afterAll` are started, the `entity` will be either [`TestSuite`](/api/advanced/test-suite) or [`TestModule`](/api/advanced/test-module).

If `beforeEach` or `afterEach` are started, the `entity` will always be [`TestCase`](/api/advanced/test-case).

::: warning
`onHookStart` method will not be called if the hook did not run during the test run.
:::

## onHookEnd

```ts
function onHookEnd(context: ReportedHookContext): Awaitable<void>
```

This method is called when any of these hooks have finished running:

- `beforeAll`
- `afterAll`
- `beforeEach`
- `afterEach`

If `beforeAll` or `afterAll` have finished, the `entity` will be either [`TestSuite`](/api/advanced/test-suite) or [`TestModule`](/api/advanced/test-module).

If `beforeEach` or `afterEach` have finished, the `entity` will always be [`TestCase`](/api/advanced/test-case).

::: warning
`onHookEnd` method will not be called if the hook did not run during the test run.
:::

## onTestSuiteReady

```ts
function onTestSuiteReady(testSuite: TestSuite): Awaitable<void>
```

This method is called before the suite starts to run its tests. This method is also called if the suite was skipped.

If the file doesn't have any suites, this method will not be called. Consider using `onTestModuleStart` to cover this use case.

## onTestSuiteResult

```ts
function onTestSuiteResult(testSuite: TestSuite): Awaitable<void>
```

This method is called after the suite has finished running tests. This method is also called if the suite was skipped.

If the file doesn't have any suites, this method will not be called. Consider using `onTestModuleEnd` to cover this use case.

## onTestCaseReady

```ts
function onTestCaseReady(testCase: TestCase): Awaitable<void>
```

This method is called before the test starts to run or it was skipped. Note that `beforeEach` and `afterEach` hooks are considered part of the test because they can influence the result.

::: warning
Notice that it's possible to have [`testCase.result()`](/api/advanced/test-case#result) with `passed` or `failed` state already when `onTestCaseReady` is called. This can happen if test was running too fast and both `onTestCaseReady` and `onTestCaseResult` were scheduled to run in the same microtask.
:::

## onTestCaseResult

```ts
function onTestCaseResult(testCase: TestCase): Awaitable<void>
```

This method is called when the test has finished running or was just skipped. Note that this will be called after the `afterEach` hook is finished, if there are any.

At this point, [`testCase.result()`](/api/advanced/test-case#result) will have non-pending state.

## onTestCaseAnnotate <Version>3.2.0</Version> {#ontestcaseannotate}

```ts
function onTestCaseAnnotate(
  testCase: TestCase,
  annotation: TestAnnotation,
): Awaitable<void>
```

The `onTestCaseAnnotate` hook is associated with the [`context.annotate`](/guide/test-context#annotate) method. When `annotate` is invoked, Vitest serialises it and sends the same attachment to the main thread where reporter can interact with it.

If the path is specified, Vitest stores it in a separate directory (configured by [`attachmentsDir`](/config/attachmentsdir)) and modifies the `path` property to reference it.

## onTestCaseArtifactRecord <Version type="experimental">4.0.11</Version> {#ontestcaseartifactrecord}

```ts
function onTestCaseArtifactRecord(
  testCase: TestCase,
  artifact: TestArtifact,
): Awaitable<void>
```

The `onTestCaseArtifactRecord` hook is associated with the [`recordArtifact`](/api/advanced/artifacts#recordartifact) utility. When `recordArtifact` is invoked, Vitest serialises it and sends the same attachment to the main thread where reporter can interact with it.

If the path is specified, Vitest stores it in a separate directory (configured by [`attachmentsDir`](/config/attachmentsdir)) and modifies the `path` property to reference it.

Note: annotations, [even though they're built on top of this feature](/api/advanced/artifacts#relationship-with-annotations), won't hit this hook and won't appear in the `task.artifacts` array for backwards compatibility reasons until the next major version.
