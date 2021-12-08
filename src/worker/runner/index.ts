import { executeInViteNode } from '../../node/execute'
import { collectTests } from '../../run/collect'
import { WorkerContext } from '../types'

export default async({ port, file }: WorkerContext) => {
  process.stdout.write('\0')

  const test = await collectTests([file])

  console.log({ test })

  port.on('message', val => console.log('worker got', val))
  port.postMessage()
}
