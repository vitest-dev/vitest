import { afterEach, beforeEach } from 'vitest'

// eslint-disable-next-line import/no-mutable-exports
export let foo: number

beforeEach(() => {
  foo = 1
})

afterEach(() => {
  foo = 2
})
