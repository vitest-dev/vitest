import { beforeAll, describe, it, expect } from 'vitest'

describe.concurrent('Hook Error Test', () => {
  describe.for(['fail-first', 'success-1', 'success-2'])('%s', (name) => {
    beforeAll(async () => {
      const start = Date.now()
      console.log(`Hook ${name} started at ${start}ms`)
      
      if (name === 'fail-first') {
        await new Promise(r => setTimeout(r, 500))
        throw new Error('Hook failed intentionally')
      }
      
      await new Promise(r => setTimeout(r, 1000))
      console.log(`Hook ${name} completed at ${Date.now()}ms`)
    })

    it(`test ${name}`, () => {
      expect(true).toBe(true)
    })
  })
})