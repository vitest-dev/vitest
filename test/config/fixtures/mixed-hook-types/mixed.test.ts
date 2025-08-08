import { beforeAll, beforeEach, afterEach, afterAll, describe, it, expect } from 'vitest'

let executionLog: string[] = []

describe.concurrent('Mixed Hook Types', () => {
  describe.for(['suite-A', 'suite-B'])('%s', (name) => {
    beforeAll(async () => {
      executionLog.push(`${name}:beforeAll:start`)
      await new Promise(r => setTimeout(r, 1000))
      executionLog.push(`${name}:beforeAll:end`)
      console.log(`${name}:beforeAll executed at ${Date.now()}ms`)
    })

    beforeEach(async () => {
      executionLog.push(`${name}:beforeEach`)
      await new Promise(r => setTimeout(r, 200))
    })

    afterEach(async () => {
      executionLog.push(`${name}:afterEach`)
      await new Promise(r => setTimeout(r, 200))
    })

    afterAll(async () => {
      executionLog.push(`${name}:afterAll:start`)
      await new Promise(r => setTimeout(r, 1000))
      executionLog.push(`${name}:afterAll:end`)
      console.log(`${name}:afterAll executed at ${Date.now()}ms`)
      
      // Log final execution order when last suite completes
      if (name === 'suite-B') {
        console.log('Execution order:', executionLog.join(' -> '))
      }
    })

    it(`${name} test 1`, () => {
      executionLog.push(`${name}:test1`)
      expect(true).toBe(true)
    })

    it(`${name} test 2`, () => {
      executionLog.push(`${name}:test2`)
      expect(true).toBe(true)
    })
  })
})