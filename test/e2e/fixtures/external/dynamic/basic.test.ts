import { expect, it } from "vitest";

it("basic", async () => {
  const getId = () => "@vitejs/test-dep-virtual";
  const mod = await import(getId());
  expect(mod.test).toBe("ok");
});
