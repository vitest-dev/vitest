import { bench } from 'vitest'

function foo() {}
class Bar {}

bench(foo, () => {})
bench(Bar, () => {})
bench(() => {}, () => {})
