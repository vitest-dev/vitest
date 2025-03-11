import { describe, it, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

describe('beforeAll', () => {
  beforeAll(async () => {
    await new Promise(() => {})
  }, 10)

  it('ok', () => {})
})

describe('beforeEach', () => {
  beforeEach(async () => {
    await new Promise(() => {})
  }, 20)

  it('ok', () => {})
})

describe('afterAll', () => {
  afterAll(async () => {
    await new Promise(() => {})
  }, 30)

  it('ok', () => {})
})

describe('afterEach', () => {
  afterEach(async () => {
    await new Promise(() => {})
  }, 40)

  it('ok', () => {})
})

describe('cleanup-beforeAll', () => {
  beforeAll(() => () => new Promise(() => {}), 50)

  it('ok', () => {})
})

describe('cleanup-beforeEach', () => {
  beforeEach(() => () => new Promise(() => {}), 60)

  it('ok', () => {})
})
