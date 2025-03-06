import { beforeEach, beforeAll, describe, test } from 'vitest';

describe('beforeEach cleanup timeout', () => {
  beforeEach(() => new Promise(() => {}), 101)
  test("ok", () => {})
})

describe('beforeAll cleanup timeout', () => {
  beforeAll(() => new Promise(() => {}), 102)
  test("ok", () => {})
})
