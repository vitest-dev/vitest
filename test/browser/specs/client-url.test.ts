import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('Browser Client URL Encoding', () => {
  beforeEach(() => {
    vi.resetModules()

    vi.stubGlobal('window', {
      __vitest_browser_runner__: {
        type: 'tester',
        sessionId: 'session-123',
        testerId: 'tester-456',
        method: 'run',
        config: {
          name: 'Components & Hooks',
        },
      },
      VITEST_API_TOKEN: 'token-789',
    })

    vi.stubGlobal('location', {
      protocol: 'http:',
      hostname: 'localhost',
      port: '5173',
    })

    vi.stubGlobal('WebSocket', class MockWebSocket {
      constructor(public url: string) {}
      addEventListener() {}
      send() {}
      close() {}
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should encode project name with ampersand in ENTRY_URL', async () => {
    const { ENTRY_URL } = await import('../../../packages/browser/src/client/client')

    const url = new URL(ENTRY_URL)

    expect(ENTRY_URL).toContain('projectName=Components%20%26%20Hooks')

    expect(url.searchParams.get('projectName')).toBe('Components & Hooks')

    expect(url.searchParams.get('type')).toBe('tester')
    expect(url.searchParams.get('sessionId')).toBe('session-123')
  })
})
