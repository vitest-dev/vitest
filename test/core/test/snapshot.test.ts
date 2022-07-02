import { expect, test } from 'vitest'
import { testOutsideInlineSnapshot } from './snapshots-outside'

test('object', () => {
  expect({
    this: { is: new Set(['of', 'snapshot']) },
  }).toMatchSnapshot()
})

test('multiline', () => {
  expect(`
  Hello
    World
`).toMatchSnapshot()
})

test('from outside', () => {
  testOutsideInlineSnapshot()
})

test('with big array', () => {
  expect({
    this: { is: new Set(['one', new Array(30).fill({})]) },
  }).toMatchSnapshot()
})

test('with big string', () => {
  expect({
    this: { is: new Set(['one', new Array(30).fill('zoo').join()]) },
  }).toMatchSnapshot()
})

test('throwing', async () => {
  expect(() => {
    throw new Error('omega')
  }).toThrowErrorMatchingSnapshot()

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw 'omega'
  }).toThrowErrorMatchingSnapshot()

  expect(() => {
    // eslint-disable-next-line no-throw-literal
    throw { error: 'omega' }
  }).toThrowErrorMatchingSnapshot()

  await expect(async () => {
    throw new Error('omega')
  }).rejects.toThrowErrorMatchingSnapshot()
})

test('throwing expect should be a function', async () => {
  expect(() => {
    expect(new Error('omega')).toThrowErrorMatchingSnapshot()
  }).toThrow(/expected must be a function/)
})

test('properties snapshot', () => {
  const user = {
    createdAt: new Date(),
    id: Math.floor(Math.random() * 20),
    name: 'LeBron James',
  }

  expect(user).toMatchSnapshot({
    createdAt: expect.any(Date),
    id: expect.any(Number),
    name: expect.stringContaining('LeBron'),
  })
})

test.fails('properties snapshot fails', () => {
  const user = {
    createdAt: new Date(),
    id: Math.floor(Math.random() * 20),
    name: 'LeBron James',
  }

  expect(user).toMatchSnapshot({
    createdAt: expect.any(Date),
    id: expect.any(String),
  })
})
