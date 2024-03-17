import {  afterAll, beforeAll, suite, test } from "vitest";

beforeAll(() => {
  setInterval(() => {}, 1000)
})

afterAll(() => {
  setInterval(() => {}, 1000)
})

suite('suite 1', () => {
  test('hanging ops 1', () => {
    setInterval(() => {}, 1000)
  })

  suite('suite 2', () => {
    test('hanging ops 2', () => {
      setInterval(() => {}, 1000)
    })
  })
})
