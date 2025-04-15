import { expect, it } from 'vitest'

declare global {
  const testValue: string
}

const custom = it.extend({
  providedConfigValue: ['default value', { injected: true }],
})

custom('provided config value is injected', ({ providedConfigValue }) => {
  expect(providedConfigValue).toBe(
    // happy-dom provides the value in the workspace config
    expect.getState().environment === 'node'
      ? 'default value'
      : 'actual config value',
  )
})

it('the same file works with different projects', () => {
  expect(testValue).toBe(expect.getState().environment === 'node' ? 'node' : 'jsdom')
})
