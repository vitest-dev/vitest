import { it } from 'vitest';

it('fails', () => {
  console.log('log fail')
  throw new Error('failed')
})
