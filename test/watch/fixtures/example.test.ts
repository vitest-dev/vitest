import { expect, test } from 'vitest'

import { getHelloWorld } from './example'

// @ts-expect-error not typed txt
import answer from './42.txt?raw'

test('answer is 42', () => {
  expect(answer).toContain('42')
})

test('getHello', async () => {
  expect(getHelloWorld()).toBe('Hello world')
})
