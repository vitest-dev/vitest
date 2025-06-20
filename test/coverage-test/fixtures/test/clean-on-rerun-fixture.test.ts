import { expect, test } from 'vitest'
import * as math from '../src/math'

// This line will be changed by clean-on-rerun.test.ts
const methodToTest = 'sum'

test(`run ${methodToTest}`, () => {
  expect(() => math[methodToTest](1, 2)).not.toThrow()
})
