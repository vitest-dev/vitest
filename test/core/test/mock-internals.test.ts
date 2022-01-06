import { exec } from 'child_process'
import { expect, test, vi } from 'vitest'
import { execDefault, execHelloWorld } from '../src/exec'

vi.mock('child_process', () => {
  return {
    exec: vi.fn(),
  }
})

test('node internal is mocked', () => {
  execHelloWorld()
  expect(exec).toHaveBeenCalledWith('hello world')

  execDefault()
  expect(exec).toHaveBeenCalledWith('default')
})
