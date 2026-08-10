# Mocking Classes

You can mock an entire class with a single [`vi.fn`](/api/vi#fn) call.

```ts
class Dog {
  name: string

  constructor(name: string) {
    this.name = name
  }

  static getType(): string {
    return 'animal'
  }

  greet = (): string => {
    return `Hi! My name is ${this.name}!`
  }

  speak(): string {
    return 'bark!'
  }

  isHungry() {}
  feed() {}
}
```

We can re-create this class with `vi.fn` (or `vi.spyOn().mockImplementation()`):

```ts
const Dog = vi.fn(class {
  static getType = vi.fn(() => 'mocked animal')

  constructor(name) {
    this.name = name
  }

  greet = vi.fn(() => `Hi! My name is ${this.name}!`)
  speak = vi.fn(() => 'loud bark!')
  feed = vi.fn()
})
```

::: warning
If a non-primitive is returned from the constructor function, that value will become the result of the new expression. In this case the `[[Prototype]]` may not be correctly bound:

```ts
const CorrectDogClass = vi.fn(function (name) {
  this.name = name
})

const IncorrectDogClass = vi.fn(name => ({
  name
}))

const Marti = new CorrectDogClass('Marti')
const Newt = new IncorrectDogClass('Newt')

Marti instanceof CorrectDogClass // ✅ true
Newt instanceof IncorrectDogClass // ❌ false!
```

If you are mocking classes, prefer the class syntax over the function.
:::

::: tip WHEN TO USE?
Generally speaking, you would re-create a class like this inside the module factory if the class is re-exported from another module:

```ts
import { Dog } from './dog.js'

vi.mock(import('./dog.js'), () => {
  const Dog = vi.fn(class {
    feed = vi.fn()
    // ... other mocks
  })
  return { Dog }
})
```

This method can also be used to pass an instance of a class to a function that accepts the same interface:

```ts [src/feed.ts]
function feed(dog: Dog) {
  // ...
}
```
```ts [tests/dog.test.ts]
import { expect, test, vi } from 'vitest'
import { feed } from '../src/feed.js'

const Dog = vi.fn(class {
  feed = vi.fn()
})

test('can feed dogs', () => {
  const dogMax = new Dog('Max')

  feed(dogMax)

  expect(dogMax.feed).toHaveBeenCalled()
  expect(dogMax.isHungry()).toBe(false)
})
```
:::

Now, when we create a new instance of the `Dog` class its `speak` method (alongside `feed` and `greet`) is already mocked:

```ts
const Cooper = new Dog('Cooper')
Cooper.speak() // loud bark!
Cooper.greet() // Hi! My name is Cooper!

// you can use built-in assertions to check the validity of the call
expect(Cooper.speak).toHaveBeenCalled()
expect(Cooper.greet).toHaveBeenCalled()

const Max = new Dog('Max')

// methods are not shared between instances if you assigned them directly
expect(Max.speak).not.toHaveBeenCalled()
expect(Max.greet).not.toHaveBeenCalled()
```

You don't have to redefine every method as a class field. Instances keep the prototype chain of the implementation class, so methods defined with the regular class syntax are available on instances, both during and after construction, and instances pass `instanceof` checks against the implementation class:

```ts
class OriginalDog {
  constructor(name) {
    this.name = name
  }

  speak() {
    return 'bark!'
  }
}

const MockedDog = vi.fn(OriginalDog)
const dog = new MockedDog('Cooper')

dog.speak() // bark!
dog instanceof MockedDog // true
dog instanceof OriginalDog // true
```

Note that nothing is mocked in this example. Unlike the `speak = vi.fn()` field in the `Dog` example above, `dog.speak` refers to the original class method, so per-instance assertions no longer work:

```ts
expect(dog.speak).toHaveBeenCalled()
// TypeError: [Function speak] is not a spy or a call to a spy!
```

To track calls, override the method on the mock's `prototype`. The override affects every instance, including already created ones, but all instances now share a single mock: there is no separate call history per instance like with class fields. To find out which instance made a call, check [`mock.contexts`](/api/mock#mock-contexts):

```ts
MockedDog.prototype.speak = vi.fn(() => 'woof!')

const cooper = new MockedDog('Cooper')
const max = new MockedDog('Max')

cooper.speak() // woof!
max.speak() // woof!

// calls from both instances are recorded by the same mock
expect(MockedDog.prototype.speak).toHaveBeenCalledTimes(2)
// `mock.contexts` keeps the instance of every call
expect(vi.mocked(MockedDog.prototype.speak).mock.contexts).toEqual([cooper, max])
```

::: warning
The mock's `prototype` follows the implementation of the last `new` call. If a single mock is constructed with different class implementations, for example, via `mockImplementationOnce`, instances created by earlier implementations lose access to their prototype methods once a newer implementation is constructed. Own properties assigned in the constructor or via class fields are not affected.
:::

We can reassign the return value for a specific instance:

```ts
const dog = new Dog('Cooper')

// "vi.mocked" is a type helper, since
// TypeScript doesn't know that Dog is a mocked class,
// it wraps any function in a Mock<T> type
// without validating if the function is a mock
vi.mocked(dog.speak).mockReturnValue('woof woof')

dog.speak() // woof woof
```

To mock the property, we can use the `vi.spyOn(dog, 'name', 'get')` method. This makes it possible to use spy assertions on the mocked property:

```ts
const dog = new Dog('Cooper')

const nameSpy = vi.spyOn(dog, 'name', 'get').mockReturnValue('Max')

expect(dog.name).toBe('Max')
expect(nameSpy).toHaveBeenCalledTimes(1)
```

::: tip
You can also spy on getters and setters using the same method.
:::

::: danger
Using classes with `vi.fn()` was introduced in Vitest 4. Previously, you had to use `function` and `prototype` inheritance directly. See [v3 guide](https://v3.vitest.dev/guide/mocking.html#classes).
:::
