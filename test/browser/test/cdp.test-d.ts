import type { PlaywrightBrowserProvider } from '@vitest/browser-playwright'
import type { cdp } from 'vitest/browser'
import { expectTypeOf, test } from 'vitest'
import { } from 'vitest/config'

test('client and server side cdps', () => {
  type ServerSideCDP = Awaited<ReturnType<InstanceType<typeof PlaywrightBrowserProvider>['getCDPSession']>>
  type CDP = ReturnType<typeof cdp> & ServerSideCDP

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
