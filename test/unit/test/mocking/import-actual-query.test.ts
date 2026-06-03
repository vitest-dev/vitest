import { expect, test, vi } from 'vitest'
// @ts-expect-error no type
import * as target from './import-actual-query-target?raw'

// @ts-expect-error no type
vi.mock(import('./import-actual-query-target?raw'), async (importOriginal) => {
  const original = await importOriginal<any>()
  return {
    ...original,
    mocked: 'ok',
  }
})

test('importOriginal preserves query parameters', () => {
  expect({ ...target }).toMatchInlineSnapshot(`
    {
      "default": "export default 'import-actual-query-target'
    ",
      "mocked": "ok",
    }
  `)
})
