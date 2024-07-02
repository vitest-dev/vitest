import { expect, test } from 'vitest'
import { multiply } from '../src/math'

test('cover multiply', () => {
 expect(multiply(3, 2)).toBe(6)
})
