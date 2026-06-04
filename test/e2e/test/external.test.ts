import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it('can inline fully dynamic import', async () => {
  const { errorTree } = await runVitest({
    root: 'fixtures/external/dynamic',
  })
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.ts": {
        "basic": "passed",
      },
    }
  `)
})
