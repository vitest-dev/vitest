// @jsxRuntime automatic
// @jsxImportSource react-18

import { expect, test } from 'vitest'

test('react 18', () => {
  expect(<div>hello</div>).toMatchInlineSnapshot(`
    <div>
      hello
    </div>
  `)
})
