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
  myEqual("sync", "x");
});

test("async", async () => {
  await myEqualAsync("async", "x");
});

test("soft", () => {
  myEqualSoft("soft", "x");
});

test("soft async", async () => {
  await myEqualSoftAsync("soft async", "x");
});

// Nested helpers: outermost marker wins
const innerHelper = vi.helper((a: any, b: any) => {
  expect(a).toEqual(b);
});
const outerHelper = vi.helper((a: any, b: any) => {
  innerHelper(a, b);
});

test("nested", () => {
  outerHelper("nested", "x");
});

// Helper that passes
test("pass sync", () => {
  myEqual(1, 1);
});

test("pass async", async () => {
  await myEqualAsync(1, 1);
});

// Helper returning value
const myAdd = vi.helper((a: number, b: number) => {
  return a + b;
});
const myAddAsync = vi.helper(async (a: number, b: number) => {
  await new Promise((r) => setTimeout(r, 1));
  return a + b;
});

test("return sync", () => {
  expect(myAdd(1, 2)).toBe(3);
});

test("return async", async () => {
  expect(await myAddAsync(1, 2)).toBe(3);
});

// Multiple soft errors in one test
test("multiple soft", () => {
  myEqualSoft("first", "x");
  myEqualSoft("second", "y");
});

// Custom error in helper
const throwCustom = vi.helper(() => {
  throw new Error("custom error from helper");
});

test("custom error", () => {
  throwCustom();
});

// non-helper wrapper calling a helper: stack should include the wrapper
function assertEqualValues(a: any, b: any) {
  myEqual(a, b);
}

test("non-helper wrapper", () => {
  assertEqualValues("wrapper", "x");
});

// printConsoleTrace also hides internal stacks
const myHelperWithLogs = vi.helper(() => {
  console.error("[test-myHelperWithLogs]");
});

test("helper with logs", () => {
  myHelperWithLogs();
});
