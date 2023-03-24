import { expect, it } from 'vitest'

it('alert', async () => {
  expect(alert('test')).toBeNull()
})

it('prompt', async () => {
  expect(prompt('test')).toBeNull()
})

it('confirm', async () => {
  expect(confirm('test')).toBeNull()
})
