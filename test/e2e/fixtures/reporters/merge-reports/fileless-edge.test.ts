import { describe, expect, it, vi } from 'vitest'

vi.mock('#mocks/not-on-disk.ts', () => ({ someExport: { mocked: true } }))
// @ts-expect-error — file does not exist, mock factory satisfies the import
import { someExport } from '#mocks/not-on-disk.ts'

describe('fileless edge repro', () => {
  it('consumes the mock', () => {
    expect(someExport).toEqual({ mocked: true })
  })
})