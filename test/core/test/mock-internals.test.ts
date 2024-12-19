import childProcess, { exec } from 'node:child_process'
import timers from 'node:timers'
import { afterEach, beforeEach, describe, expect, type MockInstance, test, vi } from 'vitest'
import { dynamicImport } from '../src/dynamic-import'
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
  expect(timers.clearInterval(undefined)).toBe('foo')
})

test('mocked dynamically imported packages', async () => {
  const mod = await dynamicImport('timers')
  expect(mod).toHaveProperty('default')
  expect(mod.default).toHaveProperty('clearInterval')
  expect(mod.default.clearInterval()).toBe('foo')
})

describe('Math.random', () => {
  describe('mock is restored', () => {
    let spy: MockInstance

    beforeEach(() => {
      spy = vi.spyOn(Math, 'random').mockReturnValue(0.1)
    })
    afterEach(() => {
      spy.mockRestore()
    })

    test('is mocked', () => {
      expect(Math.random()).toBe(0.1)
    })
  })

  // This used to make dependencies stuck, e.g. birpc
  describe('mock is not restored and leaks', () => {
    beforeEach(() => {
      vi.spyOn(Math, 'random').mockReturnValue(0.1)
    })

    test('is mocked', () => {
      expect(Math.random()).toBe(0.1)
    })
  })
})
