import { expect, test } from 'vitest'

test('dynamic relative import works', async() => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = './../src/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('dynamic aliased import works', async() => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '@/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('dynamic absolute import works', async() => {
  const stringTimeoutMod = await import('./../src/timeout')

  const timeoutPath = '/src/timeout'
  const variableTimeoutMod = await import(timeoutPath)

  expect(stringTimeoutMod).toBe(variableTimeoutMod)
})

test('data with dynamic import works', async() => {
  const dataUri = 'data:text/javascript;charset=utf-8,export default "hi"'
  const { default: hi } = await import(dataUri)
  expect(hi).toBe('hi')
})
