import { test, expect } from "vitest"

// pnpm -C test/snapshots test:fixtures --root test/fixtures/file

test('white space', async () => {
  await expect(`

  white space
`).toMatchFileSnapshot('snapshot-1.txt')
})

test('indent', async () => {
  await expect(`\
example: |
  {
    echo "hello"
  }
some:
  nesting:
    - "hello world"
even:
  more:
    nesting: true
`).toMatchFileSnapshot('snapshot-2.txt')
})
