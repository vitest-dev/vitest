import type {
  Bench,
  BenchFnOptions,
  BenchRegistration,
  BenchResult,
  BenchStorage,
  TestContext,
} from 'vitest'
import { assertType, expect, expectTypeOf, test } from 'vitest'

test('plain `bench()` returns BenchRegistration with the name literal narrowed', ({ bench }) => {
  const reg = bench('plain', () => {})
  expectTypeOf(reg).toEqualTypeOf<BenchRegistration<'plain'>>()
  expectTypeOf(reg.name).toEqualTypeOf<'plain'>()
})

test('`bench(name, options, fn)` is the preferred options-second overload', ({ bench }) => {
  const reg = bench('x', { beforeEach: () => {} }, () => {})
  expectTypeOf(reg).toEqualTypeOf<BenchRegistration<'x'>>()
})

test('`bench(name, fn, options)` is a type error — options as third arg is not accepted', ({ bench }) => {
  // @ts-expect-error legacy (name, fn, options) form is no longer accepted
  bench('x', () => {}, { beforeEach: () => {} } satisfies BenchFnOptions)
})

test('every modifier factory narrows the name literal', ({ bench }) => {
  expectTypeOf(bench.withBaseline('b', () => {})).toEqualTypeOf<BenchRegistration<'b'>>()
  expectTypeOf(bench.perProject('p', () => {})).toEqualTypeOf<BenchRegistration<'p'>>()
  expectTypeOf(bench.withBaseline.perProject('c', () => {})).toEqualTypeOf<BenchRegistration<'c'>>()
  expectTypeOf(bench.perProject.withBaseline('d', () => {})).toEqualTypeOf<BenchRegistration<'d'>>()
})

test('`bench.compare(...regs)` returns a BenchStorage keyed by the UNION of registration names', async ({ bench }) => {
  const storage = await bench.compare(bench('a', () => {}), bench('b', () => {}))
  expectTypeOf(storage).toEqualTypeOf<BenchStorage<'a' | 'b'>>()
  expectTypeOf(storage.get('a')).toEqualTypeOf<BenchResult>()
  expectTypeOf(storage.get('b')).toEqualTypeOf<BenchResult>()
})

test('`bench.compare(...).get(unknownName)` is a type error', async ({ bench }) => {
  const storage = await bench.compare(bench('a', () => {}), bench('b', () => {}))
  // @ts-expect-error 'missing' is not one of 'a' | 'b'
  storage.get('missing')
})

test('`bench.compare` accepts BenchCompareOptions as the trailing argument', async ({ bench }) => {
  const storage = await bench.compare(
    bench('a', () => {}),
    bench('b', () => {}),
    { time: 10, iterations: 5 },
  )
  expectTypeOf(storage).toEqualTypeOf<BenchStorage<'a' | 'b'>>()
})

test('`expect(result).toBeFasterThan` and `.toBeSlowerThan` are callable on BenchResult', () => {
  const a = {} as BenchResult
  const b = {} as BenchResult
  // calling both matchers must type-check; runtime behaviour is in Bucket F
  assertType<void>(expect(a).toBeFasterThan(b))
  assertType<void>(expect(a).toBeFasterThan(b, { delta: 0.1 }))
  assertType<void>(expect(a).toBeSlowerThan(b))
  assertType<void>(expect(a).toBeSlowerThan(b, { delta: 0.1 }))
})

test('`TestContext.bench` is typed as the `Bench` factory', () => {
  type CtxBench = TestContext['bench']
  expectTypeOf<CtxBench>().toEqualTypeOf<Bench>()
})
