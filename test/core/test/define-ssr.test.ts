import { afterAll, expect, test } from 'vitest'

declare let __DEFINE__: string
declare let __JSON__: any
declare let __MODE__: string
declare let __UNDEFINED__: undefined
declare let __NULL__: null
declare let __ZERO__: 0
declare let __FALSE__: false
declare let SOME: {
  VARIABLE: string
  SOME: {
    VARIABLE: string
  }
}

// functions to test that they are not statically replaced
function get__DEFINE__() {
  return __DEFINE__
}
function get__JSON__() {
  return __JSON__
}
function get__MODE__() {
  return __MODE__
}

const MODE = process.env.MODE

afterAll(() => {
  process.env.MODE = MODE
})

test('automatically remove process and global', () => {
  expect(Object.keys(process).length > 1).toBe(true)
  expect(Object.keys(globalThis).length > 1).toBe(true)
})

test('process.env.HELLO_PROCESS is defined on "defined" but exists on process.env', () => {
  expect('HELLO_PROCESS' in process.env).toBe(true)
  expect(process.env.HELLO_PROCESS).toBe('hello process')
})

test('can redeclare standard define', () => {
  expect(get__DEFINE__()).toBe('defined')
  __DEFINE__ = 'new defined'
  expect(get__DEFINE__()).toBe('new defined')
})

test('can redeclare json object', () => {
  expect(get__JSON__()).toEqual({ hello: 'world' })
  __JSON__ = { hello: 'test' }
  const name = '__JSON__'
  expect(get__JSON__()).toEqual({ hello: 'test' })
  expect((globalThis as any)[name]).toEqual({ hello: 'test' })
})

test('reassigning __MODE__', () => {
  const env = process.env.MODE
  expect(get__MODE__()).toBe(env)
  process.env.MODE = 'development'
  expect(get__MODE__()).toBe('development')
})

test('dotted defines are processed by Vite, but cannot be reassigned', () => {
  expect(SOME.VARIABLE).toBe('variable')
  expect(SOME.SOME.VARIABLE).toBe('nested variable')
  SOME.VARIABLE = 'new variable'
  expect(SOME.VARIABLE).not.toBe('new variable')
})

test('falsy defines are passed', () => {
  expect(__UNDEFINED__).toBe(undefined)
  expect(__NULL__).toBe(null)
  expect(__ZERO__).toBe(0)
  expect(__FALSE__).toBe(false)
})
