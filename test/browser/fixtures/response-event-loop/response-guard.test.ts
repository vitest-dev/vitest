import { expect, test } from 'vitest'
import { channel } from '@vitest/browser/client'

test('response:prefixed event is not processed by tester', async () => {
  const url = new URL(location.href)
  const sessionId = url.searchParams.get('sessionId')!
  const iframeId = url.searchParams.get('iframeId')!

  const secondChannel = new BroadcastChannel(`vitest:${sessionId}`)

  const nestedResponses: string[] = []
  const handler = (e: MessageEvent) => {
    if (typeof e.data?.event === 'string' && e.data.event.startsWith('response:response:')) {
      nestedResponses.push(e.data.event)
    }
    secondChannel.postMessage({
      event: `response:${e.data.event}`,
      iframeId: e.data.iframeId!,
    })
  }
  secondChannel.addEventListener('message', handler)
  secondChannel.postMessage({
    event: 'response:test',
    iframeId,
  })

  await new Promise(resolve => setTimeout(resolve, 5))

  secondChannel.removeEventListener('message', handler)
  secondChannel.close()

  expect(nestedResponses).toHaveLength(0)
})
