import type {
  BaselineData,
  Bench,
  BenchFnOptions,
  BenchFromSource,
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

test('`bench.from(name, path)` returns BenchRegistration with the name literal narrowed', ({ bench }) => {
  const reg = bench.from('baseline', 'results/baseline.json')
  expectTypeOf(reg).toEqualTypeOf<BenchRegistration<'baseline'>>()
  expectTypeOf(reg.name).toEqualTypeOf<'baseline'>()
})

test('`bench.from(name, source)` accepts a function returning BaselineData', ({ bench }) => {
  const sync: BenchFromSource = () => ({} as BaselineData)
  const async: BenchFromSource = async () => ({} as BaselineData)
  expectTypeOf(bench.from('s', sync)).toEqualTypeOf<BenchRegistration<'s'>>()
  expectTypeOf(bench.from('a', async)).toEqualTypeOf<BenchRegistration<'a'>>()
})

test('`bench.from(...).fn` is optional — `bench.from` registrations carry no benchmark function', ({ bench }) => {
  const reg = bench.from('baseline', 'results.json')
  expectTypeOf(reg.fn).toEqualTypeOf<BenchRegistration<'baseline'>['fn']>()
  expectTypeOf(reg.fn).toBeNullable()
})

test('`bench.from` registrations contribute to the name union in `bench.compare`', async ({ bench }) => {
  const storage = await bench.compare(
    bench('live', () => {}),
    bench.from('baseline', 'results.json'),
  )
  expectTypeOf(storage).toEqualTypeOf<BenchStorage<'live' | 'baseline'>>()
  expectTypeOf(storage.get('baseline')).toEqualTypeOf<BenchResult>()
})

test('`bench.from(fn, source)` accepts a function and uses its name as the benchmark name', ({ bench }) => {
  function myBench() {}
  const reg = bench.from(myBench, 'results.json')
  expectTypeOf(reg).toEqualTypeOf<BenchRegistration<string>>()
})

test('`bench.from(name)` without a source is a type error', ({ bench }) => {
  // @ts-expect-error second argument (source) is required
  bench.from('baseline')
})
