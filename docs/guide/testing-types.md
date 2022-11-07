---
title: Testing Types | Guide
---

# Testing Types

Vitest allows you to write tests for your types, using `expectTypeOf` or `assertType` syntaxes. By default all tests inside `*.test-d.ts` files are considered type tests, but you can change it with [`typecheck.include`](/config/#typecheck-include) config option.

Under the hood Vitest calls `tsc` or `vue-tsc`, depending on your config, and parses results. Vitest will also print out type errors in your source code, if it finds any. You can disable it with [`typecheck.ignoreSourceErrors`](/config/#typecheck-ignoresourceerrors) config option.

Keep in mind that Vitest doesn't run or compile these files, they are only statically analyzed by the compiler, and because of that you cannot use any dynamic statements. Meaning, you cannot use dynamic test names, and `test.each`, `test.runIf`, `test.skipIf`, `test.each`, `test.concurrent` APIs. But you can use other APIs, like `test`, `describe`, `.only`, `.skip` and `.todo`.

Using CLI flags, like `--allowOnly` and `-t` are also supported for type checking.

```ts
import { assertType, expectTypeOf } from 'vitest'
import { mount } from './mount.js'

test('my types work properly', () => {
  expectTypeOf(mount).toBeFunction()
  expectTypeOf(mount).parameter(0).toMatchTypeOf<{ name: string }>()

  // @ts-expect-error name is a string
  assertType(mount({ name: 42 }))
})
```

Any type error triggered inside a test file will be treated as a test error, so you can use any type trick you want to test types of your project.

You can see a list of possible matchers in [API section](/api/#expecttypeof).

## Reading Errors

If you are using `expectTypeOf` API, you might notice hard to read errors or unexpected:

```ts
expectTypeOf(1).toEqualTypeOf<string>()
//             ^^^^^^^^^^^^^^^^^^^^^^
// index-c3943160.d.ts(90, 20): Arguments for the rest parameter 'MISMATCH' were not provided.
```

This is due to how [`expect-type`](https://github.com/mmkal/expect-type) handles type errors.

Unfortunately, TypeScript doesn't provide type metadata without patching, so we cannot provide useful error messages at this point, but there are <a href="https://github.com/microsoft/TypeScript/pull/40468" tatger="_blank">works in TypeScript project</a> to fix this. If you want better messages, please, ask TypeScript team to have a look at mentioned PR.

If you find it hard working with `expectTypeOf` API and figuring out errors, you can always use more simple `assertType` API:

```ts
const answer = 42

assertType<number>(answer)
// @ts-expect-error answer is not a string
assertType<string>(answer)
```

::: tip
When using `@ts-expect-error` syntax, you might want to make sure that you didn't make a typo. You can do that by including your type files in [`test.include`](/config/#include) config option, so Vitest will also actually *run* these tests and fail with `ReferenceError`.

This will pass, because it expects an error, but the word “answer” has a typo, so it's a false positive error:

```ts
// @ts-expect-error answer is not a string
assertType<string>(answr) //
```
:::

## Run typechecking

Add this command to your `scripts` section in `package.json`:

```json
{
  "scripts": {
    "typecheck": "vitest typecheck"
  }
}
```

Now you can run typecheck:

```sh
# npm
npm run typecheck

# yarn
yarn typecheck

# pnpm
pnpm run typecheck
```

Vitest uses `tsc --noEmit` or `vue-tsc --noEmit`, depending on your configuration, so you can remove these scripts from your pipeline.
