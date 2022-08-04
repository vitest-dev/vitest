import type { MessagePort } from 'worker_threads'
import process from 'process'
import v8 from 'v8'
import { run } from './worker'

async function initialize(data: any) {
  if (typeof data === 'object' && data && data.action === 'run') {
    process.off('message', initialize)
    await run({
      ...data.data,
      port: {
        postMessage: (data: any) => process.send!(v8.serialize(data)),
        addListener: (event: string, fn: (data: any) => void) => process.on(event, (data) => {
          if (data.type === 'Buffer')
            return fn(v8.deserialize(Buffer.from(data.data)))

          return fn(data)
        }),
      } as unknown as MessagePort,
    }).finally(() => {
      process.send!({ action: 'finished' })
    })
  }
}

process.on('message', initialize)
