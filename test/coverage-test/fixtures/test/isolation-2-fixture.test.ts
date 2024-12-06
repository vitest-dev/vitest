import { test } from "vitest";
import { branch } from "../src/branch";

test("cover some lines", async () => {
  branch(15);
});

test("cover lines", async () => {
  branch(2);
});
