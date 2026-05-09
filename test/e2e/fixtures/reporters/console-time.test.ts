import { it } from 'vitest'

it('logs to stdout and stderr at different times', async () => {
  await new Promise(resolve => setTimeout(resolve, 50))
  console.log('foo')
  await new Promise(resolve => setTimeout(resolve, 100))
  console.error('bar')
})
