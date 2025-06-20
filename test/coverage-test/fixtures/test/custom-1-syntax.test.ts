import { expect, test } from 'vitest'

// @ts-expect-error -- untyped
import output from '../src/covered.custom-1'

test('custom file loads fine', () => {
  expect(output).toMatch('Custom-1 file loaded!')
})
