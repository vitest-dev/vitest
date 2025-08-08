import { beforeAll, describe, expect, it } from 'vitest'

describe.concurrent('Browser Hook Concurrency', () => {
  describe.for(['tab1', 'tab2', 'tab3'])('%s', (tab) => {
    let startTime: number
    let endTime: number
    
    beforeAll(async () => {
      startTime = Date.now()
      console.log(`Browser hook ${tab} started at ${startTime}`)
      
      // Simulate async operation that would stress resources
      await new Promise(r => setTimeout(r, 1000))
      
      endTime = Date.now()
      console.log(`Browser hook ${tab} completed at ${endTime}, duration: ${endTime - startTime}ms`)
    })

    it(`browser test ${tab}`, () => {
      // Verify we're in browser environment
      expect(typeof document).toBe('object')
      expect(typeof window).toBe('object')
      expect(document).toBeDefined()
    })

    it(`can access DOM in ${tab}`, () => {
      const div = document.createElement('div')
      div.textContent = `Test content for ${tab}`
      expect(div.textContent).toBe(`Test content for ${tab}`)
    })
  })
})