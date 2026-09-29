// @ts-expect-error not typed import
import * as client from '/@vite/client'
import { expect, test } from 'vitest'

test('client is imported', () => {
  expect(client).toHaveProperty('createHotContext')
})
