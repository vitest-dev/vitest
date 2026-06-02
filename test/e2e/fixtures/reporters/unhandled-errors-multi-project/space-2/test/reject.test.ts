import { it } from 'vitest'

it('triggers a rejection from project 2', async () => {
  void Promise.reject(new Error('rejection from space-2'))
  await new Promise(resolve => setTimeout(resolve, 50))
})
