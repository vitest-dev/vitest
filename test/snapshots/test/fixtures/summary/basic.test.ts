import { expect, test } from 'vitest'

test('inline normal', () => {
  expect('@SNAP1').toMatchInlineSnapshot(`"@SNAP1"`)
})

test('inline repeats', { repeats: 1 }, () => {
  expect('@SNAP2').toMatchInlineSnapshot(`"@SNAP2"`)
})

test('inline retry', { retry: 1 }, (ctx) => {
  expect('@SNAP3').toMatchInlineSnapshot(`"@SNAP3"`)
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('boom')
  }
})

test('file normal', () => {
  expect('@SNAP4').toMatchSnapshot()
})

test('file repeats', { repeats: 1 }, () => {
  expect('@SNAP5').toMatchSnapshot()
})

test('file retry', { retry: 1 }, (ctx) => {
  expect('@SNAP6').toMatchSnapshot()
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('@retry')
  }
})

test('file repeats many', { repeats: 1 }, () => {
  expect('@SNAP7').toMatchSnapshot()
  expect('@SNAP8').toMatchSnapshot()
})

test('file retry many', { retry: 1 }, (ctx) => {
  expect('@SNAP9').toMatchSnapshot()
  expect('@SNAP10').toMatchSnapshot()
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('@retry')
  }
})

test('file retry partial', { retry: 1 }, (ctx) => {
  expect('@SNAP11').toMatchSnapshot()
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('@retry')
  }
  expect('@SNAP12').toMatchSnapshot()
})
