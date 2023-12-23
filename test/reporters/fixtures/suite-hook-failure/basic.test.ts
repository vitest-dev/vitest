import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'

describe("fail beforeEach", () => {
  beforeEach(() => {
    throw new Error("fail");
  });

  it("run", () => {});
  it.skip("skip", () => {});
})

describe("fail beforeAll", () => {
  beforeAll(() => {
    throw new Error("fail");
  });

  it("run", () => {});
  it.skip("skip", () => {});
})

describe("fail afterEach", () => {
  afterEach(() => {
    throw new Error("fail");
  });

  it("run", () => {});
  it.skip("skip", () => {});
})

describe("fail afterAll", () => {
  afterAll(() => {
    throw new Error("fail");
  });

  it("run", () => {});
  it.skip("skip", () => {});
})

it("ok", () => {});
