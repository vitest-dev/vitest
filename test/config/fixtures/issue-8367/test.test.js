import { beforeAll, describe, it } from 'vitest'

async function sleep(ms = 1000) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

describe.concurrent('Test Suite', () => {
  describe.for(['a', 'b'])('$0', (name) => {
    beforeAll(async () => {
      const startTime = Date.now()
      console.log(`beforeAll start: ${name} at ${startTime}ms`)
      await sleep()
      const endTime = Date.now()
      console.log(`beforeAll end: ${name} at ${endTime}ms (duration: ${endTime - startTime}ms)`)
    })

    it(`test ${name} 1`, () => {
      // Empty test - just needs to exist
    })
    
    it(`test ${name} 2`, () => {
      // Another test to make the suite more realistic
    })
  })
})