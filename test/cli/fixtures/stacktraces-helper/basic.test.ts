import { expect, test, vi } from "vitest";

const myEqual = vi.helper((a: any, b: any) => {
  expect(a).toEqual(b);
});

const myEqualAsync = vi.helper(async (a: any, b: any) => {
  await new Promise((r) => setTimeout(r, 1));
  expect(a).toEqual(b);
});

const myEqualSoft = vi.helper((a: any, b: any) => {
  expect.soft(a).toEqual(b);
});

const myEqualSoftAsync = vi.helper(async (a: any, b: any) => {
  await new Promise((r) => setTimeout(r, 1));
  expect.soft(a).toEqual(b);
});

test("sync", () => {
  myEqual("left", "right");
});

test("async", async () => {
  await myEqualAsync("left", "right");
});

test("soft", () => {
  myEqualSoft("left", "right");
});

test("soft async", async () => {
  await myEqualSoftAsync("left", "right");
});
