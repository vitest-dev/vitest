import { expect, it, onTestFinished } from 'vitest'

const collected: any[] = []

it('on-finished regular', () => {
  collected.push(1)
  onTestFinished(() => {
    collected.push(3)
  })
  collected.push(2)
})

it('on-finished context', (t) => {
  collected.push(4)
  t.onTestFinished(() => {
    collected.push(6)
  })
  collected.push(5)
})

it.fails('failed finish', () => {
  collected.push(7)
  onTestFinished(() => {
    collected.push(9)
  })
  collected.push(8)
  expect.fail('failed')
  collected.push(null)
})

it.fails('failed finish context', (t) => {
  collected.push(10)
  t.onTestFinished(() => {
    collected.push(12)
  })
  collected.push(11)
  expect.fail('failed')
  collected.push(null)
})

it('after', () => {
  expect(collected).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
})
