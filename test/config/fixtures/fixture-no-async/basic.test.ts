import { test as base, expect } from "vitest";

type Fixture = {
  simple: string,
  nested: string,
  notArrow1: string,
  notArrow2: string,
  notArrow3: string,
}

const test = base.extend<Fixture>({
  simple: async ({}, use) => {
    await use("simple");
  },
  nested: async ({ simple }, use) => {
    await use("nested:" + simple);
  },
  async notArrow1({}, use) {
    await use("notArrow1");
  },
  notArrow2: async function({}, use) {
    await use("notArrow2");
  },
  notArrow3: async function notArrow3({}, use) {
    await use("notArrow3");
  }
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

test("test notArrow", async function ({ notArrow1, notArrow2, notArrow3 }) {
  expect(notArrow1).toMatchInlineSnapshot(`"notArrow1"`)
  expect(notArrow2).toMatchInlineSnapshot(`"notArrow2"`)
  expect(notArrow3).toMatchInlineSnapshot(`"notArrow3"`)
});
