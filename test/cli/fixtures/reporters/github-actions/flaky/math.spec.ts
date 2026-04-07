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

test.todo('should compute percentages')

test.skip('should divide by zero', ({ expect }) => {
  expect.unreachable()
})

test.fails('should work with linear equations', ({ expect }) => {
  expect(true).toBe(false)
})

test('should compute square root of negative numbers', ({ expect }) => {
  expect.unreachable()
})
