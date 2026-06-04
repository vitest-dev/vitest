import { PlaywrightBrowserProvider } from '@vitest/browser-playwright'
import { expectTypeOf, test } from 'vitest'
import { cdp } from 'vitest/browser'
import { } from 'vitest/config'

test('server side cdp', async () => {
  const session = await (new PlaywrightBrowserProvider('project' as any, {}).getCDPSession(''))

  expectTypeOf(session).toHaveProperty('on')
  expectTypeOf(session).toHaveProperty('off')
  expectTypeOf(session).toHaveProperty('once')
  expectTypeOf(session).toHaveProperty('send')
  expectTypeOf(session).not.toHaveProperty('emit')

  session.on('Profiler.preciseCoverageDeltaUpdate', (event) => {
    expectTypeOf(event).toHaveProperty('result').items.toHaveProperty('functions').items.toHaveProperty('ranges').items.toHaveProperty('startOffset')
  })

  expectTypeOf(session.send('Profiler.startPreciseCoverage', {
    allowTriggeredUpdates: true,
    callCount: true,
    detailed: true,
  })).resolves.toHaveProperty('timestamp')

  expectTypeOf(session.send).toBeCallableWith('Fetch.enable')

  // @ts-expect-error -- not.toBeCallableWith() does not work
  expectTypeOf(session.send).toBeCallableWith('Some.NonExisting.Command')
})

test('client side cdps', async () => {
  const session = cdp()

  expectTypeOf(session).toHaveProperty('on')
  expectTypeOf(session).toHaveProperty('off')
  expectTypeOf(session).toHaveProperty('once')
  expectTypeOf(session).toHaveProperty('send')
  expectTypeOf(session).not.toHaveProperty('emit')

  session.on('Profiler.preciseCoverageDeltaUpdate', (event) => {
    expectTypeOf(event).toHaveProperty('result').items.toHaveProperty('functions').items.toHaveProperty('ranges').items.toHaveProperty('startOffset')
  })

  expectTypeOf(session.send('Profiler.startPreciseCoverage', {
    allowTriggeredUpdates: true,
    callCount: true,
    detailed: true,
  })).resolves.toHaveProperty('timestamp')

  expectTypeOf(session.send).toBeCallableWith('Fetch.enable')

  // @ts-expect-error -- not.toBeCallableWith() does not work
  expectTypeOf(session.send).toBeCallableWith('Some.NonExisting.Command')
})
