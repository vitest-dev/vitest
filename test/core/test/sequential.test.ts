import { describe, expect, test } from 'vitest'

const delay = (timeout: number) => new Promise(resolve => setTimeout(resolve, timeout))

let count = 0

describe.concurrent('', () => {
  describe.sequential('', () => {
    test('should pass', async ({ task }) => {
      await delay(50)
      expect(task.concurrent).toBeFalsy()
      expect(++count).toBe(1)
    })

    test('should pass', ({ task }) => {
      expect(task.concurrent).toBeFalsy()
      expect(++count).toBe(2)
    })
  })
})
