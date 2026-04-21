import { test } from 'vitest'

test('print config', () => {
  // @ts-expect-error -- internal
  console.log(JSON.stringify(globalThis.__vitest_worker__.ctx.files.map(file => file.filepath)))
})
