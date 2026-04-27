import { test } from 'vitest'

const data = [
  'one',
  'two',
  'three',
  'four',
]

data.forEach((i) => {
  test.concurrent(i, async ({ expect }) => {
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100))
    expect(i).toMatchSnapshot()
  })
})
