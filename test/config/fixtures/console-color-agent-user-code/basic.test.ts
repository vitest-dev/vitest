// @ts-expect-error fixture resolves tinyrainbow via alias in vitest.config.ts
import c from 'tinyrainbow'
import { expect, test } from 'vitest'

test('user code colors stay enabled in agent mode', () => {
  expect(c.yellow('user-color')).toContain('\x1B[33muser-color\x1B[39m')
})
