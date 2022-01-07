/**
 * @vitest-environment jsdom
 */

import { expect, test } from 'vitest'

test('Image works as expected', () => {
  const img = new Image(100)

  expect(img.width).toBe(100)
})
