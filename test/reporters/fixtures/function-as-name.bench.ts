import { bench } from 'vitest'

const options = {
  time: 0,
  iterations: 3,
  warmupTime: 0,
  warmupIterations: 0,
}

function foo() {}
class Bar {}

bench(foo, () => {}, options)
bench(Bar, () => {}, options)
bench(() => {}, () => {}, options)
