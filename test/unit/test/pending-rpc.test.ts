import type { UserConsoleLog } from '../../../packages/vitest/src/types/general'
import { expect, test } from 'vitest'
import { createRuntimeRpc, getPendingRpcArgs } from '../../../packages/vitest/src/runtime/rpc'
import { createEnvironmentTeardownError } from '../../../packages/vitest/src/runtime/utils'

test('includes a pending console log in the environment teardown error', async () => {
  const rpc = createRuntimeRpc({
    on() {},
    post() {},
    serialize: data => data,
    deserialize: data => data,
  })
  const log: UserConsoleLog = {
    content: 'late console log',
    type: 'stdout',
    time: 123,
    size: 1,
  }

  const pending = rpc.onUserConsoleLog(log).catch(error => error)
  await Promise.resolve()

  expect(getPendingRpcArgs(rpc, 'onUserConsoleLog')).toEqual([log])

  await Promise.all(rpc.$rejectPendingCalls(({ method, reject }) => {
    reject(createEnvironmentTeardownError(method, getPendingRpcArgs(rpc, method)))
  }))

  const error = await pending
  expect(error).toBeInstanceOf(Error)
  expect(error.message).toMatchInlineSnapshot(`
    "[vitest-worker]: Closing rpc while \"onUserConsoleLog\" was pending
    This can happen when an asynchronous operation is running after the test has finished.
    Make sure all asynchronous operations are awaited, or run with --detectAsyncLeaks to find leaking resources.

    The pending log was:
    late console log"
  `)
  expect(getPendingRpcArgs(rpc, 'onUserConsoleLog')).toBeUndefined()
})
