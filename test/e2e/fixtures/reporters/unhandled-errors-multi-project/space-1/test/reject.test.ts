import { it } from 'vitest'

it('triggers a rejection from project 1', async () => {
  void Promise.reject(new Error('rejection from space-1'))
  await new Promise(resolve => setTimeout(resolve, 50))
})
