import { describe, test } from 'vitest'

describe('network', () => {
  test('should fetch user data from API', { retry: 3 }, ({ expect, task }) => {
    expect(task.result?.retryCount).toBe(2)
  })

  test('should handle network timeouts gracefully', { retry: 4 }, ({ expect, task }) => {
    expect(task.result?.retryCount).toBe(4)
  })

  test('should retry failed requests', { retry: 3 }, ({ expect, task }) => {
    expect(task.result?.retryCount).toBe(1)
  })
})
