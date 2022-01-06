import childProcess, { exec } from 'child_process'
import { expect, test, vi } from 'vitest'
import { execDefault, execHelloWorld, execImportAll } from '../src/exec'

vi.mock('child_process')

test('node internal is mocked', () => {
  execHelloWorld()
  expect(exec).toHaveBeenCalledWith('hello world')

  execImportAll()
  expect(exec).toHaveBeenCalledWith('import all')

  execDefault()
  expect(childProcess.exec).toHaveBeenCalledWith('default')
})
