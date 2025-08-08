import { beforeAll, describe, it, expect } from 'vitest'

async function timedHook(type, name, duration = 1000) {
  const start = Date.now()
  console.log(`Hook ${type}-${name} executed at ${start}ms`)
  await new Promise(resolve => setTimeout(resolve, duration))
  console.log(`Hook ${type}-${name} completed at ${Date.now()}ms`)
}

// Test multiple concurrent suites with beforeAll hooks
describe.concurrent('Mixed Hooks Suite', () => {
  describe.for(['suite1', 'suite2', 'suite3', 'suite4'])('%s', (suiteName) => {
    beforeAll(async () => {
      await timedHook('beforeAll', suiteName)
    })

    it(`${suiteName} test`, () => {
      expect(true).toBe(true)
    })
  })
})