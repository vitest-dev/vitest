import { test } from 'vitest'
import EventEmitter from 'node:events'

test('write to streams', async () => {
  process.stdout.write('Worker writing to stdout')
  process.stderr.write('Worker writing to stderr')

  // `emitWarning` prints to stderr asynchronously: without waiting for the
  // event (plus one tick for the default handler's write), a fast worker
  // teardown can exit before the warning reaches the captured stderr
  const warning = new Promise<void>(resolve => process.once('warning', () => resolve()))
  triggerNodeWarning()
  await warning
  await new Promise(resolve => setImmediate(resolve))
})

function triggerNodeWarning() {
  const emitter = new TestFixturesCustomEmitter()
  emitter.setMaxListeners(2)
  emitter.addListener('message', () => {})
  emitter.addListener('message', () => {})
  emitter.addListener('message', () => {})
}

class TestFixturesCustomEmitter extends EventEmitter {}
