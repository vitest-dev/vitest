import { it } from 'vitest'

it.concurrent('1st', ({ expect }) => {
  expect('hi1').toMatchInlineSnapshot()
})

it.concurrent('2nd', ({ expect }) => {
  expect('hi2').toMatchInlineSnapshot()
})

it.concurrent('3rd', ({ expect }) => {
  expect('hi3').toMatchInlineSnapshot()
})
