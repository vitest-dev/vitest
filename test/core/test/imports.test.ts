import { expect, test } from 'vitest'

test('dynamic relative import works', async() => {
  const { timeout } = await import('./../src/timeout')

  const timeoutPath = './../src/timeout'
  const { timeout: dynamicTimeout } = await import(timeoutPath)

  expect(timeout).toBe(dynamicTimeout)
})

test('dynamic aliased import works', async() => {
  const { timeout } = await import('./../src/timeout')

  const timeoutPath = '@/timeout'
  const { timeout: dynamicTimeout } = await import(timeoutPath)

  expect(timeout).toBe(dynamicTimeout)
})

test('dynamic absolute import works', async() => {
  const { timeout } = await import('./../src/timeout')

  const timeoutPath = '/src/timeout'
  const { timeout: dynamicTimeout } = await import(timeoutPath)

  expect(timeout).toBe(dynamicTimeout)
})

test('data with dynamic import works', async() => {
  const dataUri = 'data:text/javascript;charset=utf-8,export default "hi"'
  const { default: hi } = await import(dataUri)
  expect(hi).toBe('hi')
})
