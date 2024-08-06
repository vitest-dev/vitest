import { test } from 'vitest';

interface _Unused {
  _fake: never
}

test('unhandled exception', () => {
  ;(async () => {
    throw new Error('custom_unhandled_error')
  })()
})
