# TestSpecification

The `TestSpecification` class describes what module to run as a test and its parameters.

You can only create a specification by calling [`createSpecification`](/advanced/api/test-project#createspecification) method on a test project:

```ts
const specification = project.createSpecification(
  resolve('./example.test.ts'),
  [20, 40], // optional test lines
)
```

`createSpecification` expects resolved module ID. It doesn't auto-resolve the file or check that it exists on the file system.

## taskId

[Test module's](/advanced/api/test-suite#id) identifier.

## project

This references the [`TestProject`](/advanced/api/test-project) that the test module belongs to.

## moduleId

The ID of the module in Vite's module graph. Usually, it's an absolute file path using posix separator:

```ts
'C:/Users/Documents/project/example.test.ts' // ✅
'/Users/mac/project/example.test.ts' // ✅
'C:\\Users\\Documents\\project\\example.test.ts' // ❌
```

## testModule

Instance of [`TestModule`](/advanced/api/test-module) associated with the specification. If test wasn't queued yet, this will be `undefined`.

## pool <Badge type="warning">experimental</Badge> {#pool}

The [`pool`](/config/#pool) in which the test module will run.

::: danger
It's possible to have multiple pools in a single test project with [`poolMatchGlob`](/config/#poolmatchglob) and [`typecheck.enabled`](/config/#typecheck-enabled). This means it's possible to have several specifications with the same `moduleId` but different `pool`. In Vitest 4, the project will only support a single pool, and this property will be removed.
:::

## testLines

This is an array of lines in the source code where the test files are defined. This field is defined only if the `createSpecification` method received an array.

Note that if there is no test on at least one of the lines, the whole suite will fail. An example of a correct `testLines` configuration:

::: code-group
```ts [script.js]
const specification = project.createSpecification(
  resolve('./example.test.ts'),
  [3, 8, 9],
)
```
```ts:line-numbers{3,8,9} [example.test.js]
import { test, describe } from 'vitest'

test('verification works')

describe('a group of tests', () => { // [!code error]
  // ...

  test('nested test')
  test.skip('skipped test')
})
```
:::

## toJSON

```ts
function toJSON(): SerializedTestSpecification
```

`toJSON` generates a JSON-friendly object that can be consumed by the [Browser Mode](/guide/browser/) or [Vitest UI](/guide/ui).
