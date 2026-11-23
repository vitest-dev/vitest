import { platform } from 'node:os'
import { describe, expect, it, vi } from 'vitest'
import { getBrowserPlatform } from '../../../packages/browser/src/shared/screenshotMatcher/platform'
import { resolveOptions } from '../../../packages/browser/src/node/commands/screenshotMatcher/utils'

function createContext() {
  return {
    testPath: '/repo/tests/example.test.ts',
    project: {
      serializedConfig: {
        root: '/repo',
      },
      config: {
        attachmentsDir: '/repo/.vitest-attachments',
        browser: {
          name: 'chromium',
          expect: {},
        },
      },
    },
  } as any
}

describe('screenshotMatcher browser platform', () => {
  it('uses browser-reported platform in reference and diff paths', () => {
    const resolved = resolveOptions({
      context: createContext(),
      name: 'example',
      testName: 'renders properly',
      options: { platform: 'linux' },
    })

    expect(resolved.paths.reference).toMatch(/example-chromium-linux\.png$/)
    expect(resolved.paths.diffs.actual).toMatch(/example-actual-chromium-linux\.png$/)
  })

  it('falls back to host os platform when browser platform is omitted', () => {
    const resolved = resolveOptions({
      context: createContext(),
      name: 'example',
      testName: 'renders properly',
      options: {},
    })

    expect(resolved.paths.reference).toMatch(new RegExp(`example-chromium-${platform()}\\.png$`))
  })

  it('maps navigator platform values to Node platform names', () => {
    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'Linux' },
      platform: 'Win32',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    })
    expect(getBrowserPlatform()).toBe('linux')

    vi.stubGlobal('navigator', {
      platform: 'MacIntel',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    })
    expect(getBrowserPlatform()).toBe('darwin')

    vi.stubGlobal('navigator', {
      userAgentData: { platform: 'Windows' },
      platform: 'Win32',
    })
    expect(getBrowserPlatform()).toBe('win32')

    vi.unstubAllGlobals()
  })
})
