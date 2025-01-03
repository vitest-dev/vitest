# assert

Vitest reexports the `assert` method from [`chai`](https://www.chaijs.com/api/assert/) for verifying invariants.

## assert

- **Type:** `(expression: any, message?: string) => asserts expression`

Assert that the given `expression` is truthy, otherwise the assertion fails.

```ts
import { assert, test } from 'vitest'

test('assert', () => {
  assert('foo' !== 'bar', 'foo should not be equal to bar')
})
```

## fail

- **Type:**
  - `(message?: string) => never`
  - `<T>(actual: T, expected: T, message?: string, operator?: string) => never`

Force an assertion failure.

```ts
import { assert, test } from 'vitest'

test('assert.fail', () => {
  assert.fail('error message on failure')
  assert.fail('foo', 'bar', 'foo is not bar', '===')
})
```

## isOk

- **Type:** `<T>(value: T, message?: string) => void`
- **Alias** `ok`

Assert that the given `value` is truthy.

```ts
import { assert, test } from 'vitest'

test('assert.isOk', () => {
  assert.isOk('foo', 'every truthy is ok')
  assert.isOk(false, 'this will fail since false is not truthy')
})
```

## isNotOk

- **Type:** `<T>(value: T, message?: string) => void`
- **Alias** `notOk`

Assert that the given `value` is falsy.

```ts
import { assert, test } from 'vitest'

test('assert.isNotOk', () => {
  assert.isNotOk('foo', 'this will fail, every truthy is not ok')
  assert.isNotOk(false, 'this will pass since false is falsy')
})
```

## equal

- **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts non-strict equality (==) of `actual` and `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.equal', () => {
  assert.equal(Math.sqrt(4), '2')
})
```

## notEqual

- **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts non-strict inequality (!=) of `actual` and `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.equal', () => {
  assert.notEqual(Math.sqrt(4), 3)
})
```

## strictEqual

- **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts strict equality (===) of `actual` and `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.strictEqual', () => {
  assert.strictEqual(Math.sqrt(4), 2)
})
```

## deepEqual

- **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Asserts that `actual` is deeply equal to `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.deepEqual', () => {
  assert.deepEqual({ color: 'green' }, { color: 'green' })
})
```

## notDeepEqual

- **Type:** `<T>(actual: T, expected: T, message?: string) => void`

Assert that `actual` is not deeply equal to `expected`.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepEqual', () => {
  assert.notDeepEqual({ color: 'green' }, { color: 'red' })
})
```

## isAbove

- **Type:** `(valueToCheck: number, valueToBeAbove: number, message?: string) => void`

Assert that `valueToCheck` is strictly greater than (>) `valueToBeAbove`.

```ts
import { assert, test } from 'vitest'

test('assert.isAbove', () => {
  assert.isAbove(5, 2, '5 is strictly greater than 2')
})
```

## isAtLeast

- **Type:** `(valueToCheck: number, valueToBeAtLeast: number, message?: string) => void`

Assert that `valueToCheck` is greater than or equal to (>=) `valueToBeAtLeast`.

```ts
import { assert, test } from 'vitest'

test('assert.isAtLeast', () => {
  assert.isAtLeast(5, 2, '5 is greater or equal to 2')
  assert.isAtLeast(3, 3, '3 is greater or equal to 3')
})
```

## isBelow

- **Type:** `(valueToCheck: number, valueToBeBelow: number, message?: string) => void`

Asserts `valueToCheck` is strictly less than (<) `valueToBeBelow`.

```ts
import { assert, test } from 'vitest'

test('assert.isBelow', () => {
  assert.isBelow(3, 6, '3 is strictly less than 6')
})
```

## isAtMost

- **Type:** `(valueToCheck: number, valueToBeAtMost: number, message?: string) => void`

Asserts `valueToCheck` is less than or equal to (<=) `valueToBeAtMost`.

```ts
import { assert, test } from 'vitest'

test('assert.isAtMost', () => {
  assert.isAtMost(3, 6, '3 is less than or equal to 6')
  assert.isAtMost(4, 4, '4 is less than or equal to 4')
})
```

## isTrue

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is true.

```ts
import { assert, test } from 'vitest'

const testPassed = true

test('assert.isTrue', () => {
  assert.isTrue(testPassed)
})
```

## isNotTrue

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not true.

```ts
import { assert, test } from 'vitest'

const testPassed = 'ok'

test('assert.isNotTrue', () => {
  assert.isNotTrue(testPassed)
})
```

## isFalse

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is false.

```ts
import { assert, test } from 'vitest'

const testPassed = false

test('assert.isFalse', () => {
  assert.isFalse(testPassed)
})
```

## isNotFalse

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not false.

```ts
import { assert, test } from 'vitest'

const testPassed = 'no'

test('assert.isNotFalse', () => {
  assert.isNotFalse(testPassed)
})
```

## isNull

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is null.

```ts
import { assert, test } from 'vitest'

const error = null

test('assert.isNull', () => {
  assert.isNull(error, 'error is null')
})
```

## isNotNull

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not null.

```ts
import { assert, test } from 'vitest'

const error = { message: 'error was occurred' }

test('assert.isNotNull', () => {
  assert.isNotNull(error, 'error is not null but object')
})
```

## isNaN

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is NaN.

```ts
import { assert, test } from 'vitest'

const calculation = 1 * 'vitest'

test('assert.isNaN', () => {
  assert.isNaN(calculation, '1 * "vitest" is NaN')
})
```

## isNotNaN

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not NaN.

```ts
import { assert, test } from 'vitest'

const calculation = 1 * 2

test('assert.isNotNaN', () => {
  assert.isNotNaN(calculation, '1 * 2 is Not NaN but 2')
})
```

## exists

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is neither null nor undefined.

```ts
import { assert, test } from 'vitest'

const name = 'foo'

test('assert.exists', () => {
  assert.exists(name, 'foo is neither null nor undefined')
})
```

## notExists

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is either null nor undefined.

```ts
import { assert, test } from 'vitest'

const foo = null
const bar = undefined

test('assert.notExists', () => {
  assert.notExists(foo, 'foo is null so not exist')
  assert.notExists(bar, 'bar is undefined so not exist')
})
```

## isUndefined

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is undefined.

```ts
import { assert, test } from 'vitest'

const name = undefined

test('assert.isUndefined', () => {
  assert.isUndefined(name, 'name is undefined')
})
```

## isDefined

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not undefined.

```ts
import { assert, test } from 'vitest'

const name = 'foo'

test('assert.isDefined', () => {
  assert.isDefined(name, 'name is not undefined')
})
```

## isFunction

- **Type:** `<T>(value: T, message?: string) => void`
- **Alias:** `isCallable`
Asserts that `value` is a function.

```ts
import { assert, test } from 'vitest'

function name() { return 'foo' };

test('assert.isFunction', () => {
  assert.isFunction(name, 'name is function')
})
```

## isNotFunction

- **Type:** `<T>(value: T, message?: string) => void`
- **Alias:** `isNotCallable`

Asserts that `value` is not a function.

```ts
import { assert, test } from 'vitest'

const name = 'foo'

test('assert.isNotFunction', () => {
  assert.isNotFunction(name, 'name is not function but string')
})
```

## isObject

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is an object of type Object (as revealed by Object.prototype.toString). The assertion does not match subclassed objects.

```ts
import { assert, test } from 'vitest'

const someThing = { color: 'red', shape: 'circle' }

test('assert.isObject', () => {
  assert.isObject(someThing, 'someThing is object')
})
```

## isNotObject

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not an object of type Object (as revealed by Object.prototype.toString). The assertion does not match subclassed objects.

```ts
import { assert, test } from 'vitest'

const someThing = 'redCircle'

test('assert.isNotObject', () => {
  assert.isNotObject(someThing, 'someThing is not object but string')
})
```

## isArray

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is an array.

```ts
import { assert, test } from 'vitest'

const color = ['red', 'green', 'yellow']

test('assert.isArray', () => {
  assert.isArray(color, 'color is array')
})
```

## isNotArray

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not an array.

```ts
import { assert, test } from 'vitest'

const color = 'red'

test('assert.isNotArray', () => {
  assert.isNotArray(color, 'color is not array but string')
})
```

## isString

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a string.

```ts
import { assert, test } from 'vitest'

const color = 'red'

test('assert.isString', () => {
  assert.isString(color, 'color is string')
})
```

## isNotString

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not a string.

```ts
import { assert, test } from 'vitest'

const color = ['red', 'green', 'yellow']

test('assert.isNotString', () => {
  assert.isNotString(color, 'color is not string but array')
})
```

## isNumber

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a number.

```ts
import { assert, test } from 'vitest'

const colors = 3

test('assert.isNumber', () => {
  assert.isNumber(colors, 'colors is number')
})
```

## isNotNumber

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not a number.

```ts
import { assert, test } from 'vitest'

const colors = '3 colors'

test('assert.isNotNumber', () => {
  assert.isNotNumber(colors, 'colors is not number but strings')
})
```

## isFinite

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a finite number (not NaN, Infinity).

```ts
import { assert, test } from 'vitest'

const colors = 3

test('assert.isFinite', () => {
  assert.isFinite(colors, 'colors is number not NaN or Infinity')
})
```

## isBoolean

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is a boolean.

```ts
import { assert, test } from 'vitest'

const isReady = true

test('assert.isBoolean', () => {
  assert.isBoolean(isReady, 'isReady is a boolean')
})
```

## isNotBoolean

- **Type:** `<T>(value: T, message?: string) => void`

Asserts that `value` is not a boolean.

```ts
import { assert, test } from 'vitest'

const isReady = 'sure'

test('assert.isBoolean', () => {
  assert.isBoolean(isReady, 'isReady is not a boolean but string')
})
```

## typeOf

- **Type:** `<T>(value: T, name: string, message?: string) => void`

Asserts that `value`’s type is `name`, as determined by Object.prototype.toString.

```ts
import { assert, test } from 'vitest'

test('assert.typeOf', () => {
  assert.typeOf({ color: 'red' }, 'object', 'we have an object')
  assert.typeOf(['red', 'green'], 'array', 'we have an array')
  assert.typeOf('red', 'string', 'we have a string')
  assert.typeOf(/red/, 'regexp', 'we have a regular expression')
  assert.typeOf(null, 'null', 'we have a null')
  assert.typeOf(undefined, 'undefined', 'we have an undefined')
})
```

## notTypeOf

- **Type:** `<T>(value: T, name: string, message?: string) => void`

Asserts that `value`’s type is not `name`, as determined by Object.prototype.toString.

```ts
import { assert, test } from 'vitest'

test('assert.notTypeOf', () => {
  assert.notTypeOf('red', 'number', '"red" is not a number')
})
```

## instanceOf

- **Type:** `<T>(value: T, constructor: Function, message?: string) => void`

Asserts that `value` is an instance of `constructor`.

```ts
import { assert, test } from 'vitest'

function Person(name) { this.name = name }
const foo = new Person('foo')

class Tea {
  constructor(name) {
    this.name = name
  }
}
const coffee = new Tea('coffee')

test('assert.instanceOf', () => {
  assert.instanceOf(foo, Person, 'foo is an instance of Person')
  assert.instanceOf(coffee, Tea, 'coffee is an instance of Tea')
})
```

## notInstanceOf

- **Type:** `<T>(value: T, constructor: Function, message?: string) => void`

Asserts that `value` is not an instance of `constructor`.

```ts
import { assert, test } from 'vitest'

function Person(name) { this.name = name }
const foo = new Person('foo')

class Tea {
  constructor(name) {
    this.name = name
  }
}
const coffee = new Tea('coffee')

test('assert.instanceOf', () => {
  assert.instanceOf(foo, Tea, 'foo is not an instance of Tea')
})
```

## include

- **Type:**
  - `(haystack: string, needle: string, message?: string) => void`
  - `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
  - `<T extends object>(haystack: WeakSet<T>, needle: T, message?: string) => void`
  - `<T>(haystack: T, needle: Partial<T>, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a value in an array, a substring in a string, or a subset of properties in an object.

```ts
import { assert, test } from 'vitest'

test('assert.include', () => {
  assert.include([1, 2, 3], 2, 'array contains value')
  assert.include('foobar', 'foo', 'string contains substring')
  assert.include({ foo: 'bar', hello: 'universe' }, { foo: 'bar' }, 'object contains property')
})
```

## notInclude

- **Type:**
  - `(haystack: string, needle: string, message?: string) => void`
  - `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
  - `<T extends object>(haystack: WeakSet<T>, needle: T, message?: string) => void`
  - `<T>(haystack: T, needle: Partial<T>, message?: string) => void`

Asserts that `haystack` does not include `needle`. It can be used to assert the absence of a value in an array, a substring in a string, or a subset of properties in an object.

```ts
import { assert, test } from 'vitest'

test('assert.notInclude', () => {
  assert.notInclude([1, 2, 3], 4, 'array doesn\'t contain 4')
  assert.notInclude('foobar', 'baz', 'foobar doesn\'t contain baz')
  assert.notInclude({ foo: 'bar', hello: 'universe' }, { foo: 'baz' }, 'object doesn\'t contain property')
})
```

## deepInclude

- **Type:**
- `(haystack: string, needle: string, message?: string) => void`
- `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
- `<T>(haystack: T, needle: T extends WeakSet<any> ? never : Partial<T>, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a value in an array or a subset of properties in an object. Deep equality is used.

```ts
import { assert, test } from 'vitest'

const obj1 = { a: 1 }
const obj2 = { b: 2 }

test('assert.deepInclude', () => {
  assert.deepInclude([obj1, obj2], { a: 1 })
  assert.deepInclude({ foo: obj1, bar: obj2 }, { foo: { a: 1 } })
})
```

## notDeepInclude

- **Type:**
  - `(haystack: string, needle: string, message?: string) => void`
  - `<T>(haystack: readonly T[] | ReadonlySet<T> | ReadonlyMap<any, T>, needle: T, message?: string) => void`
  - `<T>(haystack: T, needle: T extends WeakSet<any> ? never : Partial<T>, message?: string) => void`

Asserts that `haystack` does not include `needle`. It can be used to assert the absence of a value in an array or a subset of properties in an object. Deep equality is used.

```ts
import { assert, test } from 'vitest'

const obj1 = { a: 1 }
const obj2 = { b: 2 }

test('assert.notDeepInclude', () => {
  assert.notDeepInclude([obj1, obj2], { a: 10 })
  assert.notDeepInclude({ foo: obj1, bar: obj2 }, { foo: { a: 10 } })
})
```

## nestedInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object. Enables the use of dot- and bracket-notation for referencing nested properties. ‘[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.nestedInclude', () => {
  assert.nestedInclude({ '.a': { b: 'x' } }, { '\\.a.[b]': 'x' })
  assert.nestedInclude({ a: { '[b]': 'x' } }, { 'a.\\[b\\]': 'x' })
})
```

## notNestedInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` does not include `needle`. Can be used to assert the inclusion of a subset of properties in an object. Enables the use of dot- and bracket-notation for referencing nested properties. ‘[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.nestedInclude', () => {
  assert.notNestedInclude({ '.a': { b: 'x' } }, { '\\.a.b': 'y' })
  assert.notNestedInclude({ a: { '[b]': 'x' } }, { 'a.\\[b\\]': 'y' })
})
```

## deepNestedInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object while checking for deep equality. Enables the use of dot- and bracket-notation for referencing nested properties. ‘[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.deepNestedInclude', () => {
  assert.deepNestedInclude({ a: { b: [{ x: 1 }] } }, { 'a.b[0]': { x: 1 } })
  assert.deepNestedInclude({ '.a': { '[b]': { x: 1 } } }, { '\\.a.\\[b\\]': { x: 1 } })
})
```

## notDeepNestedInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` not includes `needle`. Can be used to assert the absence of a subset of properties in an object while checking for deep equality. Enables the use of dot- and bracket-notation for referencing nested properties. ‘[]’ and ‘.’ in property names can be escaped using double backslashes.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepNestedInclude', () => {
  assert.notDeepNestedInclude({ a: { b: [{ x: 1 }] } }, { 'a.b[0]': { y: 1 } })
  assert.notDeepNestedInclude({ '.a': { '[b]': { x: 1 } } }, { '\\.a.\\[b\\]': { y: 2 } })
})
```

## ownInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object while ignoring inherited properties.

```ts
import { assert, test } from 'vitest'

test('assert.ownInclude', () => {
  assert.ownInclude({ a: 1 }, { a: 1 })
})
```

## notOwnInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the absence of a subset of properties in an object while ignoring inherited properties.

```ts
import { assert, test } from 'vitest'

const obj1 = {
  b: 2
}

const obj2 = object.create(obj1)
obj2.a = 1

test('assert.notOwnInclude', () => {
  assert.notOwnInclude(obj2, { b: 2 })
})
```

## deepOwnInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` includes `needle`. Can be used to assert the inclusion of a subset of properties in an object while ignoring inherited properties and checking for deep equality.

```ts
import { assert, test } from 'vitest'

test('assert.deepOwnInclude', () => {
  assert.deepOwnInclude({ a: { b: 2 } }, { a: { b: 2 } })
})
```

## notDeepOwnInclude

- **Type:** `(haystack: any, needle: any, message?: string) => void`

Asserts that `haystack` not includes `needle`. Can be used to assert the absence of a subset of properties in an object while ignoring inherited properties and checking for deep equality.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepOwnInclude', () => {
  assert.notDeepOwnInclude({ a: { b: 2 } }, { a: { c: 3 } })
})
```

## match

- **Type:** `(value: string, regexp: RegExp, message?: string) => void`

Asserts that `value` matches the regular expression `regexp`.

```ts
import { assert, test } from 'vitest'

test('assert.match', () => {
  assert.match('foobar', /^foo/, 'regexp matches')
})
```

## notMatch

- **Type:** `(value: string, regexp: RegExp, message?: string) => void`

Asserts that `value` does not matches the regular expression `regexp`.

```ts
import { assert, test } from 'vitest'

test('assert.notMatch', () => {
  assert.notMatch('foobar', /^foo/, 'regexp does not match')
})
```

## property

- **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property`

```ts
import { assert, test } from 'vitest'

test('assert.property', () => {
  assert.property({ tea: { green: 'matcha' } }, 'tea')
  assert.property({ tea: { green: 'matcha' } }, 'toString')
})
```

## notProperty

- **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property`

```ts
import { assert, test } from 'vitest'

test('assert.notProperty', () => {
  assert.notProperty({ tea: { green: 'matcha' } }, 'coffee')
})
```

## propertyVal

- **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property` with a value given by `value`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notPropertyVal', () => {
  assert.propertyVal({ tea: 'is good' }, 'tea', 'is good')
})
```

## notPropertyVal

- **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property` with a value given by `value`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notPropertyVal', () => {
  assert.notPropertyVal({ tea: 'is good' }, 'tea', 'is bad')
  assert.notPropertyVal({ tea: 'is good' }, 'coffee', 'is good')
})
```

## deepPropertyVal

- **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property` with a value given by `value`. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.deepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'matcha' })
})
```

## notDeepPropertyVal

- **Type:** `<T, V>(object: T, property: string, value: V, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property` with a value given by `value`. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { black: 'matcha' })
  assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'tea', { green: 'oolong' })
  assert.notDeepPropertyVal({ tea: { green: 'matcha' } }, 'coffee', { green: 'matcha' })
})
```

## nestedProperty

- **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` has a direct or inherited property named by `property`, which can be a string using dot- and bracket-notation for nested reference.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.nestedProperty({ tea: { green: 'matcha' } }, 'tea.green')
})
```

## notNestedProperty

- **Type:** `<T>(object: T, property: string, message?: string) => void`

Asserts that `object` does not have a direct or inherited property named by `property`, which can be a string using dot- and bracket-notation for nested reference.

```ts
import { assert, test } from 'vitest'

test('assert.deepPropertyVal', () => {
  assert.notNestedProperty({ tea: { green: 'matcha' } }, 'tea.oolong')
})
```

## nestedPropertyVal

- **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` has a property named by `property` with value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.nestedPropertyVal', () => {
  assert.nestedPropertyVal({ tea: { green: 'matcha' } }, 'tea.green', 'matcha')
})
```

## notNestedPropertyVal

- **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` does not have a property named by `property` with value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notNestedPropertyVal', () => {
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'tea.green', 'konacha')
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'coffee.green', 'matcha')
})
```

## deepNestedPropertyVal

- **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` has a property named by `property` with a value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a deep equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notNestedPropertyVal', () => {
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'tea.green', 'konacha')
  assert.notNestedPropertyVal({ tea: { green: 'matcha' } }, 'coffee.green', 'matcha')
})
```

## notDeepNestedPropertyVal

- **Type:** `<T>(object: T, property: string, value: any, message?: string) => void`

Asserts that `object` does not have a property named by `property` with value given by `value`. `property` can use dot- and bracket-notation for nested reference. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.notDeepNestedPropertyVal', () => {
  assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { oolong: 'yum' })
  assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.green', { matcha: 'yuck' })
  assert.notDeepNestedPropertyVal({ tea: { green: { matcha: 'yum' } } }, 'tea.black', { matcha: 'yum' })
})
```

## lengthOf

- **Type:** `<T extends { readonly length?: number | undefined } | { readonly size?: number | undefined }>(object: T, length: number, message?: string) => void`

Asserts that `object` has a `length` or `size` with the expected value.

```ts
import { assert, test } from 'vitest'

test('assert.lengthOf', () => {
  assert.lengthOf([1, 2, 3], 3, 'array has length of 3')
  assert.lengthOf('foobar', 6, 'string has length of 6')
  assert.lengthOf(new Set([1, 2, 3]), 3, 'set has size of 3')
  assert.lengthOf(new Map([['a', 1], ['b', 2], ['c', 3]]), 3, 'map has size of 3')
})
```

## hasAnyKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has at least one of the `keys` provided. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.hasAnyKeys', () => {
  assert.hasAnyKeys({ foo: 1, bar: 2, baz: 3 }, ['foo', 'iDontExist', 'baz'])
  assert.hasAnyKeys({ foo: 1, bar: 2, baz: 3 }, { foo: 30, iDontExist: 99, baz: 1337 })
  assert.hasAnyKeys(new Map([[{ foo: 1 }, 'bar'], ['key', 'value']]), [{ foo: 1 }, 'key'])
  assert.hasAnyKeys(new Set([{ foo: 'bar' }, 'anotherKey']), [{ foo: 'bar' }, 'anotherKey'])
})
```

## hasAllKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has all and only all of the `keys` provided. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.hasAllKeys', () => {
  assert.hasAllKeys({ foo: 1, bar: 2, baz: 3 }, ['foo', 'bar', 'baz'])
  assert.hasAllKeys({ foo: 1, bar: 2, baz: 3 }, { foo: 30, bar: 99, baz: 1337 })
  assert.hasAllKeys(new Map([[{ foo: 1 }, 'bar'], ['key', 'value']]), [{ foo: 1 }, 'key'])
  assert.hasAllKeys(new Set([{ foo: 'bar' }, 'anotherKey'], [{ foo: 'bar' }, 'anotherKey']))
})
```

## containsAllKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has all of the `keys` provided but may have more keys not listed. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.containsAllKeys', () => {
  assert.containsAllKeys({ foo: 1, bar: 2, baz: 3 }, ['foo', 'baz'])
  assert.containsAllKeys({ foo: 1, bar: 2, baz: 3 }, ['foo', 'bar', 'baz'])
  assert.containsAllKeys({ foo: 1, bar: 2, baz: 3 }, { foo: 30, baz: 1337 })
  assert.containsAllKeys({ foo: 1, bar: 2, baz: 3 }, { foo: 30, bar: 99, baz: 1337 })
  assert.containsAllKeys(new Map([[{ foo: 1 }, 'bar'], ['key', 'value']]), [{ foo: 1 }])
  assert.containsAllKeys(new Map([[{ foo: 1 }, 'bar'], ['key', 'value']]), [{ foo: 1 }, 'key'])
  assert.containsAllKeys(new Set([{ foo: 'bar' }, 'anotherKey'], [{ foo: 'bar' }]))
  assert.containsAllKeys(new Set([{ foo: 'bar' }, 'anotherKey'], [{ foo: 'bar' }, 'anotherKey']))
})
```

## doesNotHaveAnyKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has none of the `keys` provided. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotHaveAnyKeys', () => {
  assert.doesNotHaveAnyKeys({ foo: 1, bar: 2, baz: 3 }, ['one', 'two', 'example'])
  assert.doesNotHaveAnyKeys({ foo: 1, bar: 2, baz: 3 }, { one: 1, two: 2, example: 'foo' })
  assert.doesNotHaveAnyKeys(new Map([[{ foo: 1 }, 'bar'], ['key', 'value']]), [{ one: 'two' }, 'example'])
  assert.doesNotHaveAnyKeys(new Set([{ foo: 'bar' }, 'anotherKey'], [{ one: 'two' }, 'example']))
})
```

## doesNotHaveAllKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` does not have at least one of the `keys` provided. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.hasAnyKeys', () => {
  assert.doesNotHaveAnyKeys({ foo: 1, bar: 2, baz: 3 }, ['one', 'two', 'example'])
  assert.doesNotHaveAnyKeys({ foo: 1, bar: 2, baz: 3 }, { one: 1, two: 2, example: 'foo' })
  assert.doesNotHaveAnyKeys(new Map([[{ foo: 1 }, 'bar'], ['key', 'value']]), [{ one: 'two' }, 'example'])
  assert.doesNotHaveAnyKeys(new Set([{ foo: 'bar' }, 'anotherKey']), [{ one: 'two' }, 'example'])
})
```

## hasAnyDeepKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has at least one of the `keys` provided. Since Sets and Maps can have objects as keys you can use this assertion to perform a deep comparison. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.hasAnyDeepKeys', () => {
  assert.hasAnyDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [1, 2]]), { one: 'one' })
  assert.hasAnyDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [1, 2]]), [{ one: 'one' }, { two: 'two' }])
  assert.hasAnyDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [{ two: 'two' }, 'valueTwo']]), [{ one: 'one' }, { two: 'two' }])
  assert.hasAnyDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), { one: 'one' })
  assert.hasAnyDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), [{ one: 'one' }, { three: 'three' }])
  assert.hasAnyDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), [{ one: 'one' }, { two: 'two' }])
})
```

## hasAllDeepKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has all and only all of the `keys` provided. Since Sets and Maps can have objects as keys you can use this assertion to perform a deep comparison. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.hasAnyDeepKeys', () => {
  assert.hasAllDeepKeys(new Map([[{ one: 'one' }, 'valueOne']]), { one: 'one' })
  assert.hasAllDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [{ two: 'two' }, 'valueTwo']]), [{ one: 'one' }, { two: 'two' }])
  assert.hasAllDeepKeys(new Set([{ one: 'one' }]), { one: 'one' })
  assert.hasAllDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), [{ one: 'one' }, { two: 'two' }])
})
```

## containsAllDeepKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` contains all of the `keys` provided. Since Sets and Maps can have objects as keys you can use this assertion to perform a deep comparison. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.containsAllDeepKeys', () => {
  assert.containsAllDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [1, 2]]), { one: 'one' })
  assert.containsAllDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [{ two: 'two' }, 'valueTwo']]), [{ one: 'one' }, { two: 'two' }])
  assert.containsAllDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), { one: 'one' })
  assert.containsAllDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), [{ one: 'one' }, { two: 'two' }])
})
```

## doesNotHaveAnyDeepKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` has none of the `keys` provided. Since Sets and Maps can have objects as keys you can use this assertion to perform a deep comparison. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotHaveAnyDeepKeys', () => {
  assert.doesNotHaveAnyDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [1, 2]]), { thisDoesNot: 'exist' })
  assert.doesNotHaveAnyDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [{ two: 'two' }, 'valueTwo']]), [{ twenty: 'twenty' }, { fifty: 'fifty' }])
  assert.doesNotHaveAnyDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), { twenty: 'twenty' })
  assert.doesNotHaveAnyDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), [{ twenty: 'twenty' }, { fifty: 'fifty' }])
})
```

## doesNotHaveAllDeepKeys

- **Type:** `<T>(object: T, keys: Array<Object | string> | { [key: string]: any }, message?: string) => void`

Asserts that `object` does not have at least one of the `keys` provided. Since Sets and Maps can have objects as keys you can use this assertion to perform a deep comparison. You can also provide a single object instead of a keys array and its keys will be used as the expected set of keys.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotHaveAllDeepKeys', () => {
  assert.doesNotHaveAllDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [1, 2]]), { thisDoesNot: 'exist' })
  assert.doesNotHaveAllDeepKeys(new Map([[{ one: 'one' }, 'valueOne'], [{ two: 'two' }, 'valueTwo']]), [{ twenty: 'twenty' }, { one: 'one' }])
  assert.doesNotHaveAllDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), { twenty: 'twenty' })
  assert.doesNotHaveAllDeepKeys(new Set([{ one: 'one' }, { two: 'two' }]), [{ one: 'one' }, { fifty: 'fifty' }])
})
```

## throws

- **Type:**
  - `(fn: () => void, errMsgMatcher?: RegExp | string, ignored?: any, message?: string) => void`
  - `(fn: () => void, errorLike?: ErrorConstructor | Error | null, errMsgMatcher?: RegExp | string | null, message?: string) => void`
- **Alias:**
  - `throw`
  - `Throw`

If `errorLike` is an Error constructor, asserts that `fn` will throw an error that is an instance of `errorLike`. If errorLike is an Error instance, asserts that the error thrown is the same instance as `errorLike`. If `errMsgMatcher` is provided, it also asserts that the error thrown will have a message matching `errMsgMatcher`.

```ts
import { assert, test } from 'vitest'

test('assert.throws', () => {
  assert.throws(fn, 'Error thrown must have this msg')
  assert.throws(fn, /Error thrown must have a msg that matches this/)
  assert.throws(fn, ReferenceError)
  assert.throws(fn, errorInstance)
  assert.throws(fn, ReferenceError, 'Error thrown must be a ReferenceError and have this msg')
  assert.throws(fn, errorInstance, 'Error thrown must be the same errorInstance and have this msg')
  assert.throws(fn, ReferenceError, /Error thrown must be a ReferenceError and match this/)
  assert.throws(fn, errorInstance, /Error thrown must be the same errorInstance and match this/)
})
```

## doesNotThrow

- **Type:** `(fn: () => void, errMsgMatcher?: RegExp | string, ignored?: any, message?: string) => void`
- **Type:** `(fn: () => void, errorLike?: ErrorConstructor | Error | null, errMsgMatcher?: RegExp | string | null, message?: string) => void`

If `errorLike` is an Error constructor, asserts that `fn` will not throw an error that is an instance of `errorLike`. If errorLike is an Error instance, asserts that the error thrown is not the same instance as `errorLike`. If `errMsgMatcher` is provided, it also asserts that the error thrown will not have a message matching `errMsgMatcher`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotThrow', () => {
  assert.doesNotThrow(fn, 'Any Error thrown must not have this message')
  assert.doesNotThrow(fn, /Any Error thrown must not match this/)
  assert.doesNotThrow(fn, Error)
  assert.doesNotThrow(fn, errorInstance)
  assert.doesNotThrow(fn, Error, 'Error must not have this message')
  assert.doesNotThrow(fn, errorInstance, 'Error must not have this message')
  assert.doesNotThrow(fn, Error, /Error must not match this/)
  assert.doesNotThrow(fn, errorInstance, /Error must not match this/)
})
```

## operator

- **Type:** `(val1: OperatorComparable, operator: Operator, val2: OperatorComparable, message?: string) => void`

Compare `val1` and `val2` using `operator`.

```ts
import { assert, test } from 'vitest'

test('assert.operator', () => {
  assert.operator(1, '<', 2, 'everything is ok')
})
```

## closeTo

- **Type:** `(actual: number, expected: number, delta: number, message?: string) => void`
- **Alias:** `approximately`

Asserts that the `actual` is equal `expected`, to within a +/- `delta` range.

```ts
import { assert, test } from 'vitest'

test('assert.closeTo', () => {
  assert.closeTo(1.5, 1, 0.5, 'numbers are close')
})
```

## sameMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` have the same members in any order. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.sameMembers', () => {
  assert.sameMembers([1, 2, 3], [2, 1, 3], 'same members')
})
```

## notSameMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` don't have the same members in any order. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.sameMembers', () => {
  assert.notSameMembers([1, 2, 3], [5, 1, 3], 'not same members')
})
```

## sameDeepMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` have the same members in any order. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.sameDeepMembers', () => {
  assert.sameDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { c: 3 }], 'same deep members')
})
```

## notSameDeepMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` don’t have the same members in any order. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.sameDeepMembers', () => {
  assert.sameDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { c: 3 }], 'same deep members')
})
```

## sameOrderedMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` have the same members in the same order. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.sameOrderedMembers', () => {
  assert.sameOrderedMembers([1, 2, 3], [1, 2, 3], 'same ordered members')
})
```

## notSameOrderedMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` have the same members in the same order. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notSameOrderedMembers', () => {
  assert.notSameOrderedMembers([1, 2, 3], [2, 1, 3], 'not same ordered members')
})
```

## sameDeepOrderedMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` have the same members in the same order. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.sameDeepOrderedMembers', () => {
  assert.sameDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }, { c: 3 }], 'same deep ordered members')
})
```

## notSameDeepOrderedMembers

- **Type:** `<T>(set1: T[], set2: T[], message?: string) => void`

Asserts that `set1` and `set2` don’t have the same members in the same order. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.notSameDeepOrderedMembers', () => {
  assert.notSameDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }, { z: 5 }], 'not same deep ordered members')
  assert.notSameDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { c: 3 }], 'not same deep ordered members')
})
```

## includeMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in any order. Uses a strict equality check (===). Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.includeMembers', () => {
  assert.includeMembers([1, 2, 3], [2, 1, 2], 'include members')
})
```

## notIncludeMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn't included in `superset` in any order. Uses a strict equality check (===). Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.notIncludeMembers', () => {
  assert.notIncludeMembers([1, 2, 3], [5, 1], 'not include members')
})
```

## includeDeepMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in any order. Uses a deep equality check. Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.includeDeepMembers', () => {
  assert.includeDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }, { b: 2 }], 'include deep members')
})
```

## notIncludeDeepMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn’t included in `superset` in any order. Uses a deep equality check. Duplicates are ignored.

```ts
import { assert, test } from 'vitest'

test('assert.notIncludeDeepMembers', () => {
  assert.notIncludeDeepMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { f: 5 }], 'not include deep members')
})
```

## includeOrderedMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in the same order beginning with the first element in `superset`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.includeOrderedMembers', () => {
  assert.includeOrderedMembers([1, 2, 3], [1, 2], 'include ordered members')
})
```

## notIncludeOrderedMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn't included in `superset` in the same order beginning with the first element in `superset`. Uses a strict equality check (===).

```ts
import { assert, test } from 'vitest'

test('assert.notIncludeOrderedMembers', () => {
  assert.notIncludeOrderedMembers([1, 2, 3], [2, 1], 'not include ordered members')
  assert.notIncludeOrderedMembers([1, 2, 3], [2, 3], 'not include ordered members')
})
```

## includeDeepOrderedMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` is included in `superset` in the same order beginning with the first element in `superset`. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.includeDeepOrderedMembers', () => {
  assert.includeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { b: 2 }], 'include deep ordered members')
})
```

## notIncludeDeepOrderedMembers

- **Type:** `<T>(superset: T[], subset: T[], message?: string) => void`

Asserts that `subset` isn’t included in `superset` in the same order beginning with the first element in superset. Uses a deep equality check.

```ts
import { assert, test } from 'vitest'

test('assert.includeDeepOrderedMembers', () => {
  assert.notIncludeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ a: 1 }, { f: 5 }], 'not include deep ordered members')
  assert.notIncludeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { a: 1 }], 'not include deep ordered members')
  assert.notIncludeDeepOrderedMembers([{ a: 1 }, { b: 2 }, { c: 3 }], [{ b: 2 }, { c: 3 }], 'not include deep ordered members')
})
```

## oneOf

- **Type:** `<T>(inList: T, list: T[], message?: string) => void`

Asserts that non-object, non-array value `inList` appears in the flat array `list`.

```ts
import { assert, test } from 'vitest'

test('assert.oneOf', () => {
  assert.oneOf(1, [2, 1], 'Not found in list')
})
```

## changes

- **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` changes the `object` of a `property`.

```ts
import { assert, test } from 'vitest'

test('assert.changes', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 22 };
  assert.changes(fn, obj, 'val')
})
```

## changesBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` changes the `object` of a `property` by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.changesBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 2 };
  assert.changesBy(fn, obj, 'val', 2)
})
```

## doesNotChange

- **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` does not changes the `object` of a `property`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotChange', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 2 };
  assert.doesNotChange(fn, obj, 'val', 2)
})
```

## changesButNotBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change:number, message?: string) => void`

Asserts that a `modifier` does not change the `object` of a `property` or of a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.changesButNotBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 10 };
  assert.changesButNotBy(fn, obj, 'val', 5)
})
```

## increases

- **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` increases a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.increases', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 13 };
  assert.increases(fn, obj, 'val')
})
```

## increasesBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` increases a numeric `object`'s `property` or a `modifier` return value by an `change`.

```ts
import { assert, test } from 'vitest'

test('assert.increasesBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 10 };
  assert.increasesBy(fn, obj, 'val', 10)
})
```

## doesNotIncrease

- **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` does not increases a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotIncrease', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 8 }
  assert.doesNotIncrease(fn, obj, 'val')
})
```

## increasesButNotBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` does not increases a numeric `object`'s `property` or a `modifier` return value by an `change`.

```ts
import { assert, test } from 'vitest'

test('assert.increasesButNotBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val += 15 };
  assert.increasesButNotBy(fn, obj, 'val', 10)
})
```

## decreases

- **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` decreases a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.decreases', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 5 };
  assert.decreases(fn, obj, 'val')
})
```

## decreasesBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` decreases a numeric `object`'s `property` or a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.decreasesBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val -= 5 };
  assert.decreasesBy(fn, obj, 'val', 5)
})
```

## doesNotDecrease

- **Type:** `<T>(modifier: Function, object: T, property: string, message?: string) => void`

Asserts that a `modifier` dose not decrease a numeric `object`'s `property`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotDecrease', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 15 }
  assert.doesNotDecrease(fn, obj, 'val')
})
```

## doesNotDecreaseBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` does not decrease a numeric `object`'s `property` or a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.doesNotDecreaseBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 5 };
  assert.doesNotDecreaseBy(fn, obj, 'val', 1)
})
```

## decreasesButNotBy

- **Type:** `<T>(modifier: Function, object: T, property: string, change: number, message?: string) => void`

Asserts that a `modifier` does not decrease a numeric `object`'s `property` or a `modifier` return value by a `change`.

```ts
import { assert, test } from 'vitest'

test('assert.decreasesButNotBy', () => {
  const obj = { val: 10 }
  function fn() { obj.val = 5 };
  assert.decreasesButNotBy(fn, obj, 'val', 1)
})
```

## ifError

- **Type:** `<T>(object: T, message?: string) => void`

Asserts if `object` is not a false value, and throws if it is a true value. This is added to allow for chai to be a drop-in replacement for Node’s assert class.

```ts
import { assert, test } from 'vitest'

test('assert.ifError', () => {
  const err = new Error('I am a custom error')
  assert.ifError(err) // Rethrows err!
})
```

## isExtensible

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `extensible`

Asserts that `object` is extensible (can have new properties added to it).

```ts
import { assert, test } from 'vitest'

test('assert.isExtensible', () => {
  assert.isExtensible({})
})
```

## isNotExtensible

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `notExtensible`

Asserts that `object` is not extensible (can not have new properties added to it).

```ts
import { assert, test } from 'vitest'

test('assert.isNotExtensible', () => {
  const nonExtensibleObject = Object.preventExtensions({})
  const sealedObject = Object.seal({})
  const frozenObject = Object.freeze({})

  assert.isNotExtensible(nonExtensibleObject)
  assert.isNotExtensible(sealedObject)
  assert.isNotExtensible(frozenObject)
})
```

## isSealed

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `sealed`

Asserts that `object` is sealed (cannot have new properties added to it and its existing properties cannot be removed).

```ts
import { assert, test } from 'vitest'

test('assert.isSealed', () => {
  const sealedObject = Object.seal({})
  const frozenObject = Object.seal({})

  assert.isSealed(sealedObject)
  assert.isSealed(frozenObject)
})
```

## isNotSealed

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `notSealed`

Asserts that `object` is not sealed (can have new properties added to it and its existing properties can be removed).

```ts
import { assert, test } from 'vitest'

test('assert.isNotSealed', () => {
  assert.isNotSealed({})
})
```

## isFrozen

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `frozen`

Asserts that object is frozen (cannot have new properties added to it and its existing properties cannot be modified).

```ts
import { assert, test } from 'vitest'

test('assert.isFrozen', () => {
  const frozenObject = Object.freeze({})
  assert.frozen(frozenObject)
})
```

## isNotFrozen

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `notFrozen`

Asserts that `object` is not frozen (can have new properties added to it and its existing properties can be modified).

```ts
import { assert, test } from 'vitest'

test('assert.isNotFrozen', () => {
  assert.isNotFrozen({})
})
```

## isEmpty

- **Type:** `<T>(target: T, message?: string) => void`
- **Alias:** `empty`

Asserts that the `target` does not contain any values. For arrays and strings, it checks the length property. For Map and Set instances, it checks the size property. For non-function objects, it gets the count of its own enumerable string keys.

```ts
import { assert, test } from 'vitest'

test('assert.isEmpty', () => {
  assert.isEmpty([])
  assert.isEmpty('')
  assert.isEmpty(new Map())
  assert.isEmpty({})
})
```

## isNotEmpty

- **Type:** `<T>(object: T, message?: string) => void`
- **Alias:** `notEmpty`

Asserts that the `target` contains values. For arrays and strings, it checks the length property. For Map and Set instances, it checks the size property. For non-function objects, it gets the count of its own enumerable string keys.

```ts
import { assert, test } from 'vitest'

test('assert.isNotEmpty', () => {
  assert.isNotEmpty([1, 2])
  assert.isNotEmpty('34')
  assert.isNotEmpty(new Set([5, 6]))
  assert.isNotEmpty({ key: 7 })
})
```
