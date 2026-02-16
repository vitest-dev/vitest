import { test } from 'vitest'

test('should add numbers correctly', { retry: 5 }, ({ expect, task }) => {
  expect(task.result?.retryCount).toBe(0)
})

test('should subtract numbers correctly', { retry: 5 }, ({ expect, task }) => {
  expect(task.result?.retryCount).toBe(1)
})

test('should multiply numbers correctly', { retry: 5 }, ({ expect, task }) => {
  expect(task.result?.retryCount).toBe(5)
})

test('should divide numbers correctly', { retry: 5 }, ({ expect, task }) => {
  expect(task.result?.retryCount).toBe(2)
})

test('should handle edge cases', { retry: 5 }, ({ expect, task }) => {
  expect(task.result?.retryCount).toBe(4)
})

test('should validate input properly', { retry: 5 }, ({ expect, task }) => {
  expect(task.result?.retryCount).toBe(4)
})
