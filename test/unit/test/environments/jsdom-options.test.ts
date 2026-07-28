import { expect, test } from 'vitest'
import jsdom from '../../../../packages/vitest/src/integrations/env/jsdom'

const userAgent = 'Vitest jsdom environment'

test('sets userAgent during global setup', async () => {
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

test('sets userAgent during VM setup', async () => {
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
