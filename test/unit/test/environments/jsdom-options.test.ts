import { expect, test } from 'vitest'
import { getWorkerState } from '../../../../packages/vitest/src/runtime/utils'

const userAgent = 'Vitest jsdom environment'
const isThreads = getWorkerState().config.pool === 'threads'

test.runIf(isThreads)('sets userAgent during global setup', async () => {
  const { default: jsdom } = await import('../../../../packages/vitest/src/integrations/env/jsdom')
  const global = {} as typeof globalThis
  const environment = await jsdom.setup(global, {
    jsdom: { userAgent },
  })

  try {
    expect(global.navigator.userAgent).toBe(userAgent)
  }
  finally {
    await environment.teardown(global)
  }
})

test.runIf(isThreads)('sets userAgent during VM setup', async () => {
  const { default: jsdom } = await import('../../../../packages/vitest/src/integrations/env/jsdom')
  const environment = await jsdom.setupVM!({
    jsdom: { userAgent },
  })

  try {
    expect(environment.getVmContext().navigator.userAgent).toBe(userAgent)
  }
  finally {
    await environment.teardown()
  }
})
