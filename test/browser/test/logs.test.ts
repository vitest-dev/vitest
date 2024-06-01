/* eslint-disable no-console */
import { test, vi } from 'vitest'

test('logging to stdout', () => {
  console.log('hello from console.log')
  console.info('hello from console.info')
  console.debug('hello from console.debug')
  console.dir({ hello: 'from dir' })
  console.dirxml({ hello: 'from dirxml' })
  console.trace('hello from console.trace')
})

test('logging to stderr', () => {
  console.error('hello from console.error')
  console.warn('hello from console.warn')
})

test('logging DOM element', () => {
  const element = document.createElement('div')
  console.log('dom', element)
})

test('logging default counter', () => {
  console.count()
  console.count()
  console.count()
  console.countReset()
  console.count()
})

test('logging custom counter', () => {
  console.count('count')
  console.count('count')
  console.count('count')
  console.countReset('count')
  console.count('count')
})

test('logging default time', () => {
  console.time()
  console.timeLog()
  console.timeEnd()
})

test('logging custom time', () => {
  console.time('time')
  console.timeLog('time')
  console.timeEnd('time')
})

test('logging invalid time', () => {
  console.timeLog('invalid timeLog')
  console.timeEnd('invalid timeEnd')
})

test('logging the stack', () => {
  vi.setConfig({ printConsoleTrace: true })
  console.log('log with a stack')
  console.error('error with a stack')
  console.trace('trace with a stack')
})
