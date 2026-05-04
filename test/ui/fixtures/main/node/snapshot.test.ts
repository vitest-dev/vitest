import { expect, test } from 'vitest';

test('wrong snapshot', () => {
  expect(1).toMatchInlineSnapshot(`2`)
})
