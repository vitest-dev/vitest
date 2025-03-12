import { describe, it, beforeAll, beforeEach, afterAll, afterEach } from "vitest"

describe('beforeAll', () => {
  beforeAll(() => new Promise(() => {}), 10)

  it('ok', () => {})
})

describe('beforeEach', () => {
  beforeEach(() => new Promise(() => {}), 20)

  it('ok', () => {})
})

describe('afterAll', () => {
  afterAll(() => new Promise(() => {}), 30)

  it('ok', () => {})
})

describe('afterEach', () => {
  afterEach(() => new Promise(() => {}), 40)

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

describe('onFailed', () => {
  it('fail', (ctx) => {
    ctx.onTestFailed(() => new Promise(() => {}), 70)
    throw new Error('fail')
  })
})

describe('onFinished', () => {
  it('ok', (ctx) => {
    ctx.onTestFinished(() => new Promise(() => {}), 80)
  })
})
