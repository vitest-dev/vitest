import { it } from 'vitest'

it('batch microtask', async () => {
  console.log('1')
  await new Promise(resolve => setTimeout(resolve, 100))
  console.log('2')
  const now = Date.now()
  while (Date.now() < now + 50) {}
  console.error('3') // this gets own entry with timestamp after `2`
  console.log('4') // this is batched to the same stdout log as `2`
})
