# API Reference

## describe and test 

### concurrent

`.concurrent` marks consecutive tests to be run them in parallel. It receives the test name, an async function with the tests to collect, and an optional timeout (in milliseconds).

```ts
// The two tests marked with concurrent will be run in parallel
describe("suite", () => {
  it("serial test", async() => { /* ... */ });
  it.concurrent("concurrent test 1", async() => { /* ... */ });
  it.concurrent("concurrent test 2", async() => { /* ... */ });
});
```

`.concurrent` in a suite marks every tests as concurrent

```ts
// All tests within this suite will be run in parallel
describe.concurrent("suite", () => {
  it("concurrent test 1", async() => { /* ... */ });
  it("concurrent test 2", async() => { /* ... */ });
  it.concurrent("concurrent test 3", async() => { /* ... */ });
});
```

`.skip`, `.only`, and `.todo` works with concurrent suites and tests. All the following combinations are valid:

```ts
describe.concurrent(...)
describe.skip.concurrent(...), describe.concurrent.skip(...)
describe.only.concurrent(...), describe.concurrent.only(...)
describe.todo.concurrent(...), describe.concurrent.todo(...)

it.concurrent(...)
it.skip.concurrent(...), it.concurrent.skip(...)
it.only.concurrent(...), it.concurrent.only(...)
it.todo.concurrent(...), it.concurrent.todo(...)
```



