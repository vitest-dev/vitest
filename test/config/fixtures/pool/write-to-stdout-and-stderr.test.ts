import { test } from 'vitest'
import EventEmitter from 'node:events'

test('write to streams', () => {
  process.stdout.write('Worker writing to stdout')
  process.stderr.write('Worker writing to stderr')

  triggerNodeWarning()
})

function triggerNodeWarning() {
  const emitter = new TestFixturesCustomEmitter()
  emitter.setMaxListeners(2)
  emitter.addListener('message', () => {})
  emitter.addListener('message', () => {})
  emitter.addListener('message', () => {})
}

class TestFixturesCustomEmitter extends EventEmitter {}