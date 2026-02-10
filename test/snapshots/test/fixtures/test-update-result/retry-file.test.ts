import { expect, test } from 'vitest'

test('file repeats', { repeats: 1 }, () => {
  expect('foo').toMatchSnapshot()
})

test('file retry', { retry: 1 }, (ctx) => {
  expect('foo').toMatchSnapshot()
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('boom')
  }
})

test('file repeats many', { repeats: 1 }, () => {
  expect('foo').toMatchSnapshot()
  expect('bar').toMatchSnapshot()
})

test('file retry many', { retry: 1 }, (ctx) => {
  expect('foo').toMatchSnapshot()
  expect('bar').toMatchSnapshot()
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('boom')
  }
})

test('file retry partial', { retry: 1 }, (ctx) => {
  expect('foo').toMatchSnapshot()
  if (ctx.task.result?.retryCount === 0) {
    throw new Error('boom')
  }
  expect('bar').toMatchSnapshot()
})
