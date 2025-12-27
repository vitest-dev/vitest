import { test } from 'vitest'

test('print config', () => {
  // @ts-expect-error -- internal
  console.log(JSON.stringify(globalThis.__vitest_worker__.config, null, 2))
})
