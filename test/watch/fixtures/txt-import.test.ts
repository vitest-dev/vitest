import { expect, it } from 'vitest'

// @ts-expect-error not typed txt
import answer from './42.txt?raw'

it('should be 42', () => {
  expect(answer).toContain('42')
})
