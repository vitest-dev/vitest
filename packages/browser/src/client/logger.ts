/* eslint-disable no-console */

import type { VitestClient } from '@vitest/ws-client'
import { importId } from './utils'

const { Date } = globalThis

export const interceptLog = async (client: VitestClient) => {
  const { stringify, format } = await importId('vitest/utils') as typeof import('vitest/utils')
  // TODO: add support for more console methods
  const { log, info, error } = console
  const processLog = (args: unknown[]) => args.map((a) => {
    if (a instanceof Element)
      return stringify(a)
    return format(a)
  }).join(' ')
  const sendLog = (type: 'stdout' | 'stderr', args: unknown[]) => {
    const content = processLog(args)
    const unknownTestId = '__vitest__unknown_test__'
    // @ts-expect-error untyped global
    const taskId = globalThis.__vitest_worker__?.current?.id ?? unknownTestId
    client.rpc.sendLog({
      content,
      time: Date.now(),
      taskId,
      type,
      size: content.length,
    })
  }
  const stdout = (base: (...args: unknown[]) => void) => (...args: unknown[]) => {
    sendLog('stdout', args)
    return base(...args)
  }
  console.log = stdout(log)
  console.info = stdout(info)

  console.error = (...args) => {
    sendLog('stderr', args)
    return error(...args)
  }
}
