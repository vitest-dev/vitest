// @vitest-environment node

import { expect, test } from 'vitest'
import happyDomEnvironment from '../../../../packages/vitest/src/integrations/env/happy-dom'

// https://github.com/vitest-dev/vitest/issues/11328
// Under a vm pool the happy-dom `Window` *is* the vm context, and it has no
// `BroadcastChannel` (happy-dom#1920), while the `threads` pool keeps Node's
// global visible. Libraries that construct a `BroadcastChannel` at import time
// (e.g. `msw/node`) then fail to load under vm pools.
test('setupVM bridges BroadcastChannel from Node', async () => {
  const environment = happyDomEnvironment as any
  expect(environment.setupVM).toBeTypeOf('function')

  const vmContext = await environment.setupVM({})
  try {
    const win = vmContext.getVmContext()
    expect(win.BroadcastChannel).toBeTypeOf('function')
    expect(win.BroadcastChannel).toBe(BroadcastChannel)
  } finally {
    await vmContext.teardown()
  }
})
