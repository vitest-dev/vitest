import {  afterAll, beforeAll, suite, test } from "vitest";

beforeAll(() => {
  setTimeout(() => {}, 1000)
})

afterAll(() => {
  setTimeout(() => {}, 1000)
})

suite('suite 1', () => {
  test('hanging ops 1', () => {
    setTimeout(() => {}, 1000)
  })

  suite('suite 2', () => {
    test('hanging ops 2', () => {
      setTimeout(() => {}, 1000)
    })
  })
})
