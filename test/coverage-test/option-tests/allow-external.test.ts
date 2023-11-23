import { expect, test } from 'vitest'

import { multiply } from '../src/utils'
import * as ExternalMath from '../../test-utils/fixtures/math'

test('calling files outside project root', () => {
  expect(ExternalMath.sum(2, 3)).toBe(5)
})

test('multiply - add some files to report', () => {
  expect(multiply(2, 3)).toBe(6)
})
