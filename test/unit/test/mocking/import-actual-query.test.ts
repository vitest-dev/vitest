import { expect, test, vi } from 'vitest'
import * as target from './import-actual-query-target?raw'

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
