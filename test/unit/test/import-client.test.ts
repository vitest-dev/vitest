import { expect, test } from 'vitest'
// @ts-expect-error not typed import
import * as client from '/@vite/client'

test('client is imported', () => {
  expect(client).toHaveProperty('createHotContext')
})
