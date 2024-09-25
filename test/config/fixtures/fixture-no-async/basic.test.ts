import { test as base, expect } from "vitest";

type Fixture = {
  simple: string,
  nested: string,
}

const test = base.extend<Fixture>({
  simple: async ({}, use) => {
    await use("simple");
  },
  nested: async ({ simple }, use) => {
    await use("nested:" + simple);
  },
});

test("test sync", ({ simple, nested }) => {
  expect(simple).toBe("simple");
  expect(nested).toBe("nested:simple")
});

test("test async", async ({ simple, nested }) => {
  expect(simple).toBe("simple");
  expect(nested).toBe("nested:simple")
});

test.for([1, 2])("test.for sync %i", (i, { expect, simple, nested }) => {
  expect(i).toBeTypeOf("number")
  expect(simple).toBe("simple");
  expect(nested).toBe("nested:simple")
})

test.for([1, 2])("test.for async %i", async (i, { expect, simple, nested }) => {
  expect(i).toBeTypeOf("number")
  expect(simple).toBe("simple");
  expect(nested).toBe("nested:simple")
})
