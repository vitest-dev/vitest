// @jsxRuntime automatic
// @jsxImportSource react-19

import { expect, test } from 'vitest'

test('react 19', () => {
  expect(<div>hello</div>).toMatchInlineSnapshot(`
    <div>
      hello
    </div>
  `)
})
