import { expect, test } from 'vitest'

import { getHelloWorld } from './example'

test('getHello', async () => {
  expect(getHelloWorld()).toBe('Hello world')
})
