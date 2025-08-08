import { beforeAll, afterAll, describe, it, expect } from 'vitest'

describe.concurrent('Parent Suite', () => {
  beforeAll(async () => {
    const start = Date.now()
    console.log(`Hook parent started at ${start}ms`)
    await new Promise(r => setTimeout(r, 1000))
    console.log(`Hook parent executed at ${Date.now()}ms`)
    console.log('parent-beforeAll executed')
  })
  
  afterAll(async () => {
    console.log('parent-afterAll executed')
  })

  describe.for(['child-1', 'child-2'])('Child Suite %s', (name) => {
    beforeAll(async () => {
      const start = Date.now()
      console.log(`Hook ${name} started at ${start}ms`)
      await new Promise(r => setTimeout(r, 1000))
      console.log(`Hook ${name} executed at ${Date.now()}ms`)
      console.log(`child-beforeAll-${name} executed`)
    })
    
    afterAll(async () => {
      console.log(`child-afterAll-${name} executed`)
    })

    it(`test ${name}`, () => {
      expect(true).toBe(true)
    })
  })
})