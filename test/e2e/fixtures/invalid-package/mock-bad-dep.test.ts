// @ts-expect-error no type
import * as dep from 'test-dep-invalid'
import { expect, test, vi } from 'vitest'

vi.mock('test-dep-invalid', () => ({ mocked: 'ok' }))

test('basic', () => {
  expect(dep).toMatchObject({ mocked: 'ok' })
})
