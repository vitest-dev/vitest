import {  afterAll, beforeAll, suite, test } from "vitest";

beforeAll(() => {
  setTimeout(() => {}, 1000)
})

afterAll(() => {
  setTimeout(() => {}, 1000)
})

suite('suite 1', () => {
  test('test 1', () => {
    setInterval(() => {}, 1000)
  })

  suite('suite 2', () => {
    test('test 2', () => {
      setInterval(() => {}, 1000)
    })
  })
})
