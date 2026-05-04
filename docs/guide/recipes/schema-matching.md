---
title: Schema-Driven Assertions | Recipes
---

# Schema-Driven Assertions

If your project already validates data with [Zod](https://zod.dev), [Valibot](https://valibot.dev), or [ArkType](https://arktype.io), those schemas already describe what a valid value looks like. Reusing them in tests is more direct than duplicating shape checks across `toEqual` and `toMatchObject`.

[`expect.schemaMatching`](/api/expect#expect-schemamatching) <Version>4.0.0</Version> is an asymmetric matcher that takes any [Standard Schema v1](https://standardschema.dev) object and passes if the value conforms to it.

## Pattern

```ts
import { expect, test } from 'vitest'
import { z } from 'zod'

test('email validation', () => {
  const user = { email: 'john@example.com' }

  expect(user).toEqual({
    email: expect.schemaMatching(z.string().email()),
  })
})
```

`expect.schemaMatching` is an asymmetric matcher, so it composes inside any equality check the same way `expect.any` or `expect.stringMatching` do:

- `toEqual` / `toStrictEqual`
- `toMatchObject`
- `toContainEqual`
- `toThrow`
- `toHaveBeenCalledWith`
- `toHaveReturnedWith`
- `toHaveBeenResolvedWith`

## Works with any Standard Schema library

```ts
import { expect, test } from 'vitest'
import { z } from 'zod'
import * as v from 'valibot'
import { type } from 'arktype'

const user = { email: 'john@example.com' }

// Zod
expect(user).toEqual({
  email: expect.schemaMatching(z.string().email()),
})

// Valibot
expect(user).toEqual({
  email: expect.schemaMatching(v.pipe(v.string(), v.email())),
})

// ArkType
expect(user).toEqual({
  email: expect.schemaMatching(type('string.email')),
})
```

## Verifying call arguments

A common use is asserting that a mock was called with data that conforms to a schema, without spelling out every field:

```ts
import { expect, test, vi } from 'vitest'
import { z } from 'zod'

const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.date(),
})

test('persists a valid user', () => {
  const repo = { save: vi.fn() }
  registerUser(repo, { email: 'a@b.com' })

  expect(repo.save).toHaveBeenCalledWith(expect.schemaMatching(UserSchema))
})
```

Reach for `schemaMatching` when you already have a schema for the value and would otherwise spell out every property by hand. It's especially useful for assertions over generated fields like UUIDs or timestamps, where you can validate the format without predicting the exact value.

## See also

- [`expect.schemaMatching`](/api/expect#expect-schemamatching)
- [Standard Schema](https://standardschema.dev)
- [Asymmetric Matchers](/api/expect)
