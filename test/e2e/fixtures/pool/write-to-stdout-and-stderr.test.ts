import { test } from 'vitest'
import EventEmitter from 'node:events'

test('write to streams', async () => {
  process.stdout.write('Worker writing to stdout')
  process.stderr.write('Worker writing to stderr')

  const warningEmitted = new Promise<void>((resolve) => {
    process.once('warning', () => setImmediate(resolve))
  })
  triggerNodeWarning()
  await warningEmitted
})

function triggerNodeWarning() {
  const emitter = new TestFixturesCustomEmitter()
  emitter.setMaxListeners(2)
  emitter.addListener('message', () => {})
  emitter.addListener('message', () => {})
  emitter.addListener('message', () => {})
}

class TestFixturesCustomEmitter extends EventEmitter {}