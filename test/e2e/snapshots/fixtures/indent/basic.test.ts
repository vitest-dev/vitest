import { test, expect } from "vitest"

// pnpm -C test/snapshots test:fixtures --root test/fixtures/indent

test('toMatchSnapshot string', () => {
  expect(`
1111
    xxxx {
    }

`).toMatchSnapshot()
})

test('toMatchInlineSnapshot string', () => {
  expect(`
2222
    yyyy {
    }

`).toMatchInlineSnapshot(`
  "
  2222
      yyyy {
      }

  "
`)
})
