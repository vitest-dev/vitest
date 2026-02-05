import { expect, test } from "vitest";
import { helper } from "./helper.ts";

const myEqual = helper((a: any, b: any) => {
  expect(a).toEqual(b);
});

const myEqualAsync = helper(async (a: any, b: any) => {
  await new Promise((r) => setTimeout(r, 1));
  expect(a).toEqual(b);
});

const myEqualSoft = helper((a: any, b: any) => {
  expect.soft(a).toEqual(b);
});

const myEqualSoftAsync = helper(async (a: any, b: any) => {
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
