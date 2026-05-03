import { test } from 'vitest'

const options = {
  time: 0,
  iterations: 3,
  warmupTime: 0,
  warmupIterations: 0,
}

function foo() {}
class Bar {}

test('benches', async ({ bench, annotate }) => {
  await bench.compare(
    bench(foo, () => {}),
    bench(Bar, () => {}),
    bench(() => {}, () => {}),
    options,
  )
})

