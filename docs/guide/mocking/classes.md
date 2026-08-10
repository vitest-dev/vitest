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

Notice that this class defines its members in two different ways, and the difference matters for mocking:

- `greet` is a class field. The assignment runs during construction, so every instance gets its own copy of the function as its own property.
- `speak`, `isHungry`, and `feed` are prototype methods. They are created once and stored on `Dog.prototype`, an object that all instances share. An instance doesn't have a `speak` property of its own: when you call `dog.speak()`, JavaScript doesn't find `speak` on the instance and continues looking on `Dog.prototype`. Every instance finds the same function there, so `dog.speak === Dog.prototype.speak` is `true`.

We can re-create this class with `vi.fn` (or `vi.spyOn().mockImplementation()`). By defining every method as a class field, each instance gets its own separate mock, which allows checking calls on a single instance:

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
  isHungry = vi.fn(() => false)
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

You don't have to redefine every method as a class field. Instances keep the prototype chain of the class you pass to `vi.fn`, so prototype methods stay available on instances, both during and after construction, and instances pass `instanceof` checks against that class:

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

Note that nothing is mocked in this example. Unlike the `speak = vi.fn()` field in the `Dog` example above, the instance doesn't receive its own mock function. `dog.speak` is found through the prototype chain and refers to the original class method (`dog.speak === MockedDog.prototype.speak`), so call assertions throw:

```ts
expect(dog.speak).toHaveBeenCalled()
// TypeError: [Function speak] is not a spy or a call to a spy!
```

Since every instance finds `speak` on the prototype, you can mock it for all of them at once by assigning a mock there:

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

Assigning on `MockedDog.prototype` instead of `OriginalDog.prototype` keeps the original class untouched: the lookup order is `instance` → `MockedDog.prototype` → `OriginalDog.prototype`, so the assigned function shadows the original method. Because instances look the method up on every call rather than keeping a copy, the mock is visible to all of them, even those created before the assignment. The trade-off is that they also share a single call history, unlike class fields, which give every instance its own mock.

::: warning
The mock's `prototype` follows the implementation of the last `new` call. If a single mock is constructed with different class implementations, for example, via `mockImplementationOnce`, instances created by earlier implementations lose access to their prototype methods once a newer implementation is constructed. Own properties assigned in the constructor or via class fields are not affected.
:::

If you want to mock the method of one instance only, use [`vi.spyOn`](/api/vi#vi-spyon). It defines the mock directly on that instance, shadowing the prototype method just for it:

```ts
const cooper = new MockedDog('Cooper')
const max = new MockedDog('Max')

vi.spyOn(cooper, 'speak').mockReturnValue('meow!')

cooper.speak() // meow!
max.speak() // bark!, still the original method

expect(cooper.speak).toHaveBeenCalledTimes(1)
```

When methods are defined as class fields, like in the mocked `Dog` class at the top of this page, every instance already has its own mock, so you can reassign the return value for a specific instance directly:

```ts
const dog = new Dog('Cooper')

// "vi.mocked" is a type helper, since
// TypeScript doesn't know that Dog is a mocked class,
// it wraps any function in a Mock<T> type
// without validating if the function is a mock
vi.mocked(dog.speak).mockReturnValue('woof woof')

dog.speak() // woof woof
```

To mock a non-function property, like `name`, we can use the `vi.spyOn(dog, 'name', 'get')` method. This makes it possible to use spy assertions on the mocked property:

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
