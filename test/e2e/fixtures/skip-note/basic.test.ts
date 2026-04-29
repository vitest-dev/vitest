import { test } from 'vitest';

test('my skipped test', ctx => {
  ctx.skip('custom message')
})
