import { expect, test } from 'vitest'
import * as source from './source'

test<{ source: any }>('modules are the same', (t) => {
  expect(source).toBe(t.source)
})
