import { expect, test } from 'vitest'

test('dynamic import', async () => {
  try {
    await import('non-existing-module' as any)
    expect.unreachable()
  }
  catch (err: any) {
    expect(err.message).toBe(
      `Cannot find package 'non-existing-module' imported from ${import.meta.filename.replace(/\\/g, '/')}`,
    )
    expect(err.code).toBe('ERR_MODULE_NOT_FOUND')
  }
})
