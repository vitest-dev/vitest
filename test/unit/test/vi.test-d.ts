import { expectTypeOf, test, vi } from 'vitest'

test('vi.waitUntil correctly resolves return type', () => {
  expectTypeOf(vi.waitUntil(() => 'string')).resolves.toEqualTypeOf<string>()
  expectTypeOf(vi.waitUntil(() => 1)).resolves.toEqualTypeOf<number>()

  expectTypeOf(vi.waitUntil(() => false as const)).resolves.toEqualTypeOf<never>()
  expectTypeOf(vi.waitUntil(() => '' as const)).resolves.toEqualTypeOf<never>()
  expectTypeOf(vi.waitUntil(() => 0 as const)).resolves.toEqualTypeOf<never>()

  expectTypeOf(vi.waitUntil(() => '' as '' | number)).resolves.toEqualTypeOf<number>()
  expectTypeOf(vi.waitUntil(() => null as null | number)).resolves.toEqualTypeOf<number>()
  expectTypeOf(vi.waitUntil(() => undefined as undefined | number)).resolves.toEqualTypeOf<number>()
  expectTypeOf(vi.waitUntil(() => false as false | number)).resolves.toEqualTypeOf<number>()
  expectTypeOf(vi.waitUntil(() => 0 as 0 | string)).resolves.toEqualTypeOf<string>()
})
