import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

declare module 'vitest' {
  interface Assertion<T> {
    toMatchImageSnapshot(): T
  }
}

expect.extend({ toMatchImageSnapshot })

test('image snapshot', () => {
  expect(readFileSync('./test/stubs/input-image.png')).toMatchImageSnapshot()
})
