import { expect, test } from 'vitest'

// @ts-expect-error -- untyped
import output from '../src/covered.custom-2'

test('custom-2 file loads fine', () => {
  expect(output).toMatch('Custom-2 file loaded!')
})
