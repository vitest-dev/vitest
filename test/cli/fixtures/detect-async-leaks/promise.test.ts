import {  afterAll, beforeAll, suite, test } from "vitest";

beforeAll(() => {
  new Promise(() => {})
})

afterAll(() => {
  new Promise(() => {})
})

suite('suite 1', () => {
  test('hanging ops 1', () => {
    new Promise(() => {})
  })

  suite('suite 2', () => {
    test('hanging ops 2', () => {
      new Promise(() => {})
    })
  })
})
