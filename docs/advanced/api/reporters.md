# Reporters

::: warning
This is an advanced API. If you just want to configure built-in reporters, read the ["Reporters"](/guide/reporters) guide.
:::

Vitest has its own test run lifecycle. These are represented by reporter's methods:

- [`onInit`](#oninit)
- [`onTestRunStart`](#ontestrun)
  - [`onTestModuleQueued`](#ontestmodulequeud)
  - [`onTestModuleCollected`](#ontestmodulecollected)
  - [`onTestModuleStart`](#ontestmodulestart)
    - [`onHookStart(beforeAll)`](#onhookstart)
    - [`onHookEnd(beforeAll)`](#onhookend)
    - [`onHookStart(beforeEach)`](#onhookstart)
    - [`onHookEnd(beforeEach)`](#onhookend)
      - [`onTestCaseStart`](#ontestcasestart)
      - [`onTestCaseEnd`](#ontestcaseend)
    - [`onHookStart(afterEach)`](#onhookstart)
    - [`onHookEnd(afterEach)`](#onhookend)
    - [`onHookStart(afterAll)`](#onhookstart)
    - [`onHookEnd(afterAll)`](#onhookend)
  - [`onTestModuleEnd`](ontestmoduleend)
- [`onTestRunEnd`](#ontestrunend)

::: warning
`onHookStart` and `onHookEnd` methods will not be called if these hooks did not run during the test run.

Also notice that it's possible to have [`testCase.result()`](/advanced/api/test-case#result) with `passed` or `failed` state already when [`onTestCaseStart`](#ontestcasestart) is called. This can happen if test was running too fast and both hooks were scheduled to run in the same microtask.
:::

This guide lists all supported reporter methods. However, don't forget that instead of creating your own reporter, you can [extend existing one](/advanced/reporters) instead:

```ts [custom-reporter.js]
import { BaseReporter } from 'vitest/reporters'

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

This method is called when [Vitest](/advanced/api/vitest) was initiated or started, but before the tests were filtered.

::: info
Internally this method is called inside [`vitest.start`](/advanced/api/vitest#start), [`vitest.init`](/advanced/api/vitest#init) or [`vitest.mergeReports`](/advanced/api/vitest#mergereports). If you are using programmatic API, make sure to call either one dependning on your needs before calling [`vitest.runTestSpecifications`](/advanced/api/vitest#runtestspecifications), for example. Built-in CLI will always run methods in correct order.
:::

Note that you can also get access to `vitest` instance from test cases, suites and test modules via a [`project`](/advanced/api/test-project) property, but it might also be useful to store a reference to `vitest` in this method.

::: details Example
```ts
import type { Reporter, TestSpecification } from 'vitest/reporters'
import type { Vitest } from 'vitest/node'

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

## onTestRunStart

```ts
function onTestRunStart(
  specifications: TestSpecification[]
): Awaitable<void>
```

This method is called when a new test run has started. It receives an array of [test specifications](/advanced/api/test-specification) scheduled to run. This array is readonly and available only for information purposes.

::: details Example
```ts
import type { Reporter, TestSpecification } from 'vitest/reporters'

class MyReporter implements Reporter {
  onTestRunStart(specifications: TestSpecification[]) {
    console.log(specifications.length, 'test files will run')
  }
}

export default new MyReporter()
```
:::

::: tip
This method was added in Vitest 3, replacing `onPathsCollected` and `onSpecsCollected`, both of which are now deprecated.
:::

## onTestRunEnd

```ts
function onTestRunEnd(
  testModules: ReadonlyArray<TestModule>,
  unhandledErrors: ReadonlyArray<SerializedError>,
  reason: 'passed' | 'interrupted' | 'failed'
): Awaitable<void>
```

This method is called after all tests have finished running and the coverage merged all reports, if it's enabled. Note that you can get the coverage information in [`onCoverage`](#oncoverage) hook.

It receives a readonly list of test modules. You can iterate over it via a [`testModule.children`](/advanced/api/test-collection) property to report the state and errors, if any.

The second argument is a readonly list of unhandled errors that Vitest wasn't able to attribute to any test. These can happen outside of the test run because of an error in a plugin, or inside the test run as a side-effect of a non-awaited function (for example, a timeout that threw an error after the test has finished running).

The third argument indicated why the test run was finished:

- `passed`: test run was finished normally and there are no errors
- `failed`: test run has at least one error (due to a syntax error during collection or an actual error during test execution)
- `interrupted`: test was interruped by [`vitest.cancelCurrentRun`](/advanced/api/vitest#cancelcurrentrun) call or `Ctrl+C` was pressed in the terminal (note that it's still possible to have failed tests in this case)

::: details Example
```ts
import type { Reporter, TestSpecification } from 'vitest/reporters'

class MyReporter implements Reporter {
  onTestRunEnd(
    testModules: ReadonlyArray<TestModule>,
    unhandledErrors: ReadonlyArray<SerializedError>,
    reason: 'passed' | 'interrupted' | 'failed'
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
