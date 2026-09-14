---
title: Migrating from Mocha + Chai + Sinon | Guide
outline: deep
---

# Migrating from Mocha + Chai + Sinon {#mocha-chai-sinon}

Vitest provides excellent support for migrating from Mocha+Chai+Sinon test suites. While Vitest uses a Jest-compatible API by default, it also provides Chai-style assertions for spy/mock testing, making migration easier.

## Test Structure

Mocha and Vitest have similar test structures, but with some differences:

```ts
// Mocha
describe('suite', () => {
  before(() => { /* setup */ })
  after(() => { /* teardown */ })
  beforeEach(() => { /* setup */ })
  afterEach(() => { /* teardown */ })

  it('test', () => {
    // test code
  })
})

// Vitest - same structure works!
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'

describe('suite', () => {
  beforeAll(() => { /* setup */ })
  afterAll(() => { /* teardown */ })
  beforeEach(() => { /* setup */ })
  afterEach(() => { /* teardown */ })

  it('test', () => {
    // test code
  })
})
```

## Assertions

Vitest includes Chai assertions by default, so Chai assertions work without changes:

```ts
// Both Mocha+Chai and Vitest
import { expect } from 'vitest' // or 'chai' in Mocha

expect(value).to.equal(42)
expect(value).to.be.true
expect(array).to.have.lengthOf(3)
expect(obj).to.have.property('key')
```

## Spy/Mock Assertions

Vitest provides **Chai-style assertions** for spies and mocks, allowing you to migrate from Sinon without rewriting assertions:

```ts
// Before (Mocha + Chai + Sinon)
const sinon = require('sinon')
const chai = require('chai')
const sinonChai = require('sinon-chai')
chai.use(sinonChai)

const spy = sinon.spy(obj, 'method')
obj.method('arg1', 'arg2')

expect(spy).to.have.been.called
expect(spy).to.have.been.calledOnce
expect(spy).to.have.been.calledWith('arg1', 'arg2')

// After (Vitest) - same assertion syntax!
import { expect, vi } from 'vitest'

const spy = vi.spyOn(obj, 'method')
obj.method('arg1', 'arg2')

expect(spy).to.have.been.called
expect(spy).to.have.been.calledOnce
expect(spy).to.have.been.calledWith('arg1', 'arg2')
```

### Complete Chai-Style Assertion Support

Vitest supports all common sinon-chai assertions:

| Sinon-Chai | Vitest | Description |
|------------|--------|-------------|
| `spy.called` | `called` | Spy was called at least once |
| `spy.calledOnce` | `calledOnce` | Spy was called exactly once |
| `spy.calledTwice` | `calledTwice` | Spy was called exactly twice |
| `spy.calledThrice` | `calledThrice` | Spy was called exactly three times |
| `spy.callCount(n)` | `callCount(n)` | Spy was called n times |
| `spy.calledWith(...)` | `calledWith(...)` | Spy was called with specific args |
| `spy.calledOnceWith(...)` | `calledOnceWith(...)` | Spy was called once with specific args |
| `spy.returned(value)` | `returned` | Spy returned specific value |

See the [Chai-Style Spy Assertions](/api/expect#chai-style-spy-assertions) documentation for the complete list.

## Creating Spies and Mocks

Replace Sinon's spy/stub/mock creation with Vitest's `vi` utilities:

```ts
// Sinon
const sinon = require('sinon')
const spy = sinon.spy()
const stub = sinon.stub(obj, 'method')
const mock = sinon.mock(obj)

// Vitest
import { vi } from 'vitest'
const spy = vi.fn()
const stub = vi.spyOn(obj, 'method')
// Vitest doesn't have "mocks" - use spies instead
```

## Stubbing Return Values

```ts
// Sinon
stub.returns(42)
stub.onFirstCall().returns(1)
stub.onSecondCall().returns(2)

// Vitest
stub.mockReturnValue(42)
stub.mockReturnValueOnce(1)
stub.mockReturnValueOnce(2)
```

## Stubbing Implementations

```ts
// Sinon
stub.callsFake(arg => arg * 2)

// Vitest
stub.mockImplementation(arg => arg * 2)
```

## Restoring Spies

```ts
// Sinon
spy.restore()
sinon.restore() // restore all

// Vitest
spy.mockRestore()
vi.restoreAllMocks() // restore all
```

## Timers

Both Sinon and Vitest use `@sinonjs/fake-timers` internally:

```ts
// Sinon
const clock = sinon.useFakeTimers()
clock.tick(1000)
clock.restore()

// Vitest
import { vi } from 'vitest'
vi.useFakeTimers()
vi.advanceTimersByTime(1000)
vi.useRealTimers()
```

## Key Differences

1. **Globals**: Mocha provides globals by default. In Vitest, either import from `vitest` or enable [`globals`](/config/globals) config
2. **Assertion style**: You can use both Chai-style (`expect(spy).to.have.been.called`) and Jest-style (`expect(spy).toHaveBeenCalled()`)
3. **Parallel execution**: Vitest runs tests in parallel by default, Mocha runs sequentially

For more information, see:
- [Chai-Style Spy Assertions](/api/expect#chai-style-spy-assertions)
- [Mocking Guide](/guide/mocking)
- [Vi API](/api/vi)
