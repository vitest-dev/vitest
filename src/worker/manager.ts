import { MessageChannel } from 'worker_threads'
import { dirname, join } from 'path'
import Piscina from 'piscina'

export function createWorker() {
  const piscina = new Piscina({
    filename: join(dirname(import.meta.url), 'runner/index.js'),
  })

  const channel = new MessageChannel()

  channel.port2.on('message', () => {
    channel.port2.postMessage('response from parent')
  })

  piscina.run({ port: channel.port1 }, { transferList: [channel.port1] })
}
