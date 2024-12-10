# TestSuite

The `TestSuite` class represents a single suite. This class is only available in the main thread. Refer to the ["Runner API"](/advanced/runner#tasks) if you are working with runtime tasks.

The `TestSuite` instance always has a `type` property with the value of `suite`. You can use it to distinguish between different task types:

```ts
if (task.type === 'suite') {
  task // TestSuite
}
```

::: warning
We are planning to introduce a new Reporter API that will be using this API by default. For now, the Reporter API uses [runner tasks](/advanced/runner#tasks), but you can still access `TestSuite` via `vitest.state.getReportedEntity` method:

```ts
import type { RunnerTestFile, TestModule, Vitest } from 'vitest/node'

class Reporter {
  private vitest!: Vitest

  onInit(vitest: Vitest) {
    this.vitest = vitest
  }

  onFinished(files: RunnerTestFile[]) {
    for (const file of files) {
      const testModule = this.vitest.getReportedEntity(file) as TestModule
      for (const suite of testModule.children.allSuites()) {
        console.log(suite) // TestSuite
      }
    }
  }
}
```
:::

## project

This references the [`TestProject`](/advanced/api/test-project) that the test belongs to.

## module

This is a direct reference to the [`TestModule`](/advanced/api/test-module) where the test is defined.

## name

This is a suite name that was passed to the `describe` function.

```ts
import { describe } from 'vitest'

// [!code word:'the validation logic']
describe('the validation logic', () => {
  // ...
})
```

## fullName

The name of the suite including all parent suites separated with `>` symbol. This suite has a full name "the validation logic > validating cities":

```ts
import { describe, test } from 'vitest'

// [!code word:'the validation logic']
// [!code word:'validating cities']
describe('the validation logic', () => {
  describe('validating cities', () => {
    // ...
  })
})
```

## id

This is suite's unique identifier. This ID is deterministic and will be the same for the same suite across multiple runs. The ID is based on the [project](/advanced/api/test-project) name, module ID and suite order.

The ID looks like this:

```
1223128da3_0_0_0
^^^^^^^^^^ the file hash
           ^ suite index
             ^ nested suite index
               ^ test index
```

::: tip
You can generate file hash with `generateFileHash` function from `vitest/node` which is available since Vitest 3:

```ts
import { generateFileHash } from 'vitest/node'

const hash = generateFileHash(
  '/file/path.js', // relative path
  undefined, // the project name or `undefined` is not set
)
```
:::

::: danger
Don't try to parse the ID. It can have a minus at the start: `-1223128da3_0_0_0`.
:::

## location

The location in the module where the suite was defined. Locations are collected only if [`includeTaskLocation`](/config/#includetasklocation) is enabled in the config. Note that this option is automatically enabled if `--reporter=html`, `--ui` or `--browser` flags are used.

The location of this suite will be equal to `{ line: 3, column: 1 }`:

```ts:line-numbers {3}
import { describe } from 'vitest'

describe('the validation works correctly', () => {
  // ...
})
```

## parent

Parent suite. If the suite was called directly inside the [module](/advanced/api/test-module), the parent will be the module itself.

## options

```ts
interface TaskOptions {
  each: boolean | undefined
  concurrent: boolean | undefined
  shuffle: boolean | undefined
  retry: number | undefined
  repeats: number | undefined
  mode: 'run' | 'only' | 'skip' | 'todo'
}
```

The options that suite was collected with.

## children

This is a [collection](/advanced/api/test-collection) of all suites and tests inside the current suite.

```ts
for (const task of suite.children) {
  if (task.type === 'test') {
    console.log('test', task.fullName)
  }
  else {
    // task is TaskSuite
    console.log('suite', task.name)
  }
}
```

::: warning
Note that `suite.children` will only iterate the first level of nesting, it won't go deeper.
:::

## ok

```ts
function ok(): boolean
```

Checks if the suite has any failed tests. This will also return `false` if suite failed during collection. In that case, check the [`errors()`](#errors) for thrown errors.

## skipped

```ts
function skipped(): boolean
```

Checks if the suite was skipped during collection.

## errors

```ts
function errors(): TestError[]
```

Errors that happened outside of the test run during collection, like syntax errors.

```ts {4}
import { describe } from 'vitest'

describe('collection failed', () => {
  throw new Error('a custom error')
})
```

::: warning
Note that errors are serialized into simple object: `instanceof Error` will always return `false`.
:::
