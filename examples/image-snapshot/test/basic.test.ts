import { readFileSync } from 'fs'
import { expect, test } from 'vitest'
import { toMatchImageSnapshot } from 'jest-image-snapshot'

declare global {
  namespace jest {
    interface Matchers<R> {
      toMatchImageSnapshot(): R
    }
  }
}

expect.extend({ toMatchImageSnapshot })

test('image snapshot', () => {
  expect(readFileSync('./test/stubs/input-image.png')).toMatchImageSnapshot()
})
