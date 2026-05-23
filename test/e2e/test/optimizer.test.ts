import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('external works with optimizer', async () => {
  const { errorTree } = await runVitest({
    root: 'fixtures/optimizer/external',
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "passes": "passed",
      },
    }
  `)
})
