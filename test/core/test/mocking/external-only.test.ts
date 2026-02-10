// there was issue with mocking and importing external only
// import * as dep from 'node:path'
// import { expect, test, vi } from 'vitest'

// vi.mock("node:path", () => ({ mocked: 'ok' }))

// test('repro', () => {
//   expect(dep).toMatchObject({ mocked: 'ok'})
// })

import * as dep from 'non-existing'
import { expect, test, vi } from 'vitest'

vi.mock('non-existing', () => ({ mocked: 'ok' }))

test('repro', () => {
  expect(dep).toMatchObject({ mocked: 'ok' })
})
