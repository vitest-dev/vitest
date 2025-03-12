import { beforeEach, beforeAll, describe, test, expect } from 'vitest';

describe('beforeEach cleanup timeout', () => {
  beforeEach(() => () => new Promise(() => {}), 101)
  test("ok", () => {
    expect(0).toBe(0)
  })
})

describe('beforeAll cleanup timeout', () => {
  beforeAll(() => () => new Promise(() => {}), 102)
  test("ok", () => {
    expect(0).toBe(0)
  })
})
