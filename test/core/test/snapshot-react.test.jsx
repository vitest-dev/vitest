// @jsxRuntime automatic
// @jsxImportSource react

import { expect, test } from 'vitest'

test('react 19', () => {
  expect(<div>hello</div>).toMatchInlineSnapshot(`
    <div>
      hello
    </div>
  `)
})
