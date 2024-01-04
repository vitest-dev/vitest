import { expect, test } from 'vitest'

test('file snapshot', async () => {
  await expect('inaccessible snapshot content')
    .toMatchFileSnapshot('/inaccesible/path')
})
