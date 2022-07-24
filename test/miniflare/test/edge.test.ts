/**
 *  @vitest-environment miniflare
 */
import { afterEach, describe, expect, it } from 'vitest'

declare const miniflare: import('miniflare').Miniflare

describe('KV', async () => {
  const kv = await miniflare.getKVNamespace('12345678901234567890123456789012')

  afterEach(async () => {
    await miniflare.
  })

  it('can put and get values', async () => {
    expect(kv.list()).resolves.toStrictEqual({
      cursor: '',
      keys: [],
      list_complete: true,
    })

    await kv.put('test', 'true')

    await expect(kv.list()).resolves.toStrictEqual({
      cursor: '',
      keys: [{
        name: 'test',
        expiration: undefined,
        metadata: undefined,
      }],
      list_complete: true,
    })

    await expect(kv.get('test')).resolves.toStrictEqual('true')
  })

  it('is isolated between tests', async () => {
    await expect(kv.get('test')).resolves.toBeNull()
  })
})
