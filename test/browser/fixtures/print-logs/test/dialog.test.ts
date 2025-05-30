/* eslint-disable no-alert */

import { expect, it } from 'vitest'

it('alert', async () => {
  expect(alert('test')).toBeUndefined()
})

it('prompt', async () => {
  expect(prompt('test')).toBeNull()
})

it('confirm', async () => {
  expect(confirm('test')).toBe(false)
})
