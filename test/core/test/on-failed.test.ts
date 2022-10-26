import { expect, it, onTestFailed } from 'vitest'

const collected: any[] = []

it.fails('on-failed', () => {
  const square3 = 3 ** 2
  const square4 = 4 ** 2

  onTestFailed(() => {
    // eslint-disable-next-line no-console
    console.log('Unexpected error encountered, internal states:', { square3, square4 })
    collected.push({ square3, square4 })
  })

  expect(Math.sqrt(square3 + square4)).toBe(4)
})

it('after', () => {
  expect(collected).toMatchInlineSnapshot(`
    [
      {
        "square3": 9,
        "square4": 16,
      },
    ]
  `)
})
