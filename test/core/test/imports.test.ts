import { expect, test } from 'vitest'

test('dynamic relative import works', async() => {
  const importTimeout = await import('./../src/timeout')

  const timeoutPath = './../src/timeout'
  const dynamicTimeout = await import(timeoutPath)

  expect(importTimeout).toBe(dynamicTimeout)
})

test('dynamic aliased import works', async() => {
  const importTimeout = await import('./../src/timeout')

  const timeoutPath = '@/timeout'
  const dynamicTimeout = await import(timeoutPath)

  expect(importTimeout).toBe(dynamicTimeout)
})

test('dynamic absolute import works', async() => {
  const importTimeout = await import('./../src/timeout')

  const timeoutPath = '/src/timeout'
  const dynamicTimeout = await import(timeoutPath)

  expect(importTimeout).toBe(dynamicTimeout)
})
