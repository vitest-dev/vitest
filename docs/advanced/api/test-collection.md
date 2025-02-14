# TestCollection

`TestCollection` represents a collection of top-level [suites](/advanced/api/test-suite) and [tests](/advanced/api/test-case) in a suite or a module. It also provides useful methods to iterate over itself.

::: info
Most methods return an iterator instead of an array for better performance in case you don't need every item in the collection. If you prefer working with array, you can spread the iterator: `[...children.allSuites()]`.

Also note that the collection itself is an iterator:

```ts
for (const child of module.children) {
  console.log(child.type, child.name)
}
```
:::

## size

The number of tests and suites in the collection.

::: warning
This number includes only tests and suites at the top-level, it doesn't include nested suites and tests.
:::

## at

```ts
function at(index: number): TestCase | TestSuite | undefined
```

Returns the test or suite at a specific index. This method accepts negative indexes.

## array

```ts
function array(): (TestCase | TestSuite)[]
```

The same collection but as an array. This is useful if you want to use `Array` methods like `map` and `filter` that are not supported by the `TaskCollection` implementation.

## allSuites

```ts
function allSuites(): Generator<TestSuite, undefined, void>
```

Filters all suites that are part of this collection and its children.

```ts
for (const suite of module.children.allSuites()) {
  if (suite.errors().length) {
    console.log('failed to collect', suite.errors())
  }
}
```

## allTests

```ts
function allTests(state?: TestState): Generator<TestCase, undefined, void>
```

Filters all tests that are part of this collection and its children.

```ts
for (const test of module.children.allTests()) {
  if (test.result().state === 'pending') {
    console.log('test', test.fullName, 'did not finish')
  }
}
```

You can pass down a `state` value to filter tests by the state.

## tests

```ts
function tests(state?: TestState): Generator<TestCase, undefined, void>
```

Filters only the tests that are part of this collection. You can pass down a `state` value to filter tests by the state.

## suites

```ts
function suites(): Generator<TestSuite, undefined, void>
```

Filters only the suites that are part of this collection.
