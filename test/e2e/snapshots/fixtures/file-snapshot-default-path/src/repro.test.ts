import { expect, it } from 'vitest'

// `toMatchFileSnapshot` targets the exact path that `toMatchSnapshot` would use
// for this test file by default (`__snapshots__/<file>.snap`).
it('writes a file snapshot to the default snapshot path', async () => {
  await expect('foobar').toMatchFileSnapshot('./__snapshots__/repro.test.ts.snap')
})
