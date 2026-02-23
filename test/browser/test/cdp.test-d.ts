import type { PlaywrightBrowserProvider } from '@vitest/browser-playwright'
import type { WebdriverBrowserProvider } from '@vitest/browser-webdriverio'
import type { cdp } from 'vitest/browser'
import { expectTypeOf, test } from 'vitest'
import { } from 'vitest/config'

test('client and server side cdps', () => {
  type PlaywrightServerSide = Awaited<ReturnType<InstanceType<typeof PlaywrightBrowserProvider>['getCDPSession']>>
  type WebdriverServerSide = Awaited<ReturnType<InstanceType<typeof WebdriverBrowserProvider>['getCDPSession']>>

  type CDP = ReturnType<typeof cdp> & PlaywrightServerSide & WebdriverServerSide

  expectTypeOf<CDP>().toHaveProperty('on')
  expectTypeOf<CDP>().toHaveProperty('off')
  expectTypeOf<CDP>().toHaveProperty('once')
  expectTypeOf<CDP>().toHaveProperty('send')
  expectTypeOf<CDP>().not.toHaveProperty('emit')

  const session: CDP = '' as unknown as CDP

  session.on('Profiler.preciseCoverageDeltaUpdate', (event) => {
    expectTypeOf(event).toHaveProperty('result').items.toHaveProperty('functions').items.toHaveProperty('ranges').items.toHaveProperty('startOffset')
  })

  expectTypeOf(session.send('Profiler.startPreciseCoverage', {
    allowTriggeredUpdates: true,
    callCount: true,
    detailed: true,
  })).resolves.toHaveProperty('timestamp')
})
