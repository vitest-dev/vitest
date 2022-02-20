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
