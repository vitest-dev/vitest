import { expect, it } from 'vitest'

it.fails('on-failed', ({ onTestFailed }) => {
  const square3 = 3 ** 2
  const square4 = 4 ** 2

  onTestFailed(() => {
    // eslint-disable-next-line no-console
    console.log('Unexpected error encountered, internal states:', { square3, square4 })
  })

  expect(Math.sqrt(square3 + square4)).toBe(4)
})
