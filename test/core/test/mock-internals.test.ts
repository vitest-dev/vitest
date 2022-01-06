import childProcess, { exec } from 'child_process'
import timers from 'timers'
import { expect, test, vi } from 'vitest'
import { execDefault, execHelloWorld, execImportAll } from '../src/exec'

vi.mock('child_process')
vi.mock('timers') // node built in inside __mocks__

test('node internal is mocked', () => {
  execHelloWorld()
  expect(exec).toHaveBeenCalledWith('hello world')

  execImportAll()
  expect(exec).toHaveBeenCalledWith('import all')

  execDefault()
  expect(childProcess.exec).toHaveBeenCalledWith('default')
})

test('builtin is mocked with __mocks__ folder', () => {
  expect(timers.clearInterval()).toBe('foo')
})
