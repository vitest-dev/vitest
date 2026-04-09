# Benchmarks

```ts
import { expect, test } from 'vitest'

test('it is faster to use lib1 library than lib2', { retry: 3 }, async ({ bench }) => {
  const result = await bench.compare(
    bench('lib1', () => { lib1() }),
    bench(
      'lib2',
      () => { lib2() },
      { afterAll() { doSoemthing() } }
    ),
    {
      iterations: 100,
      teardown() {
        deleteData()
      },
    },
  )

  expect(result.get('lib1')).toBeFasterThan(result.get('lib2'))
})
```
