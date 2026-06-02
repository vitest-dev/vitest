import { it } from 'vitest'

it('triggers two rejections and one uncaught exception', async () => {
  void Promise.reject(new Error('first rejection'))
  void Promise.reject(new Error('second rejection'))
  setTimeout(() => {
    throw new Error('uncaught timer')
  }, 0)
  await new Promise(resolve => setTimeout(resolve, 50))
})
