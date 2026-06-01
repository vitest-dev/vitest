import { expect, it } from "vitest";
import fs from "fs";

// @ts-expect-error no type
import { toMatchImageSnapshot } from "jest-image-snapshot";
expect.extend({ toMatchImageSnapshot });

declare module 'vitest' {
  interface Assertion<T = any> {
    toMatchImageSnapshot(): void
  }
}

// pnpm -C test/snapshots test:fixtures --root test/fixtures/jest-image-snapshot

it("toMatchImageSnapshot", async () => {
  const file = new URL("./test.png", import.meta.url)
  expect(fs.readFileSync(file)).toMatchImageSnapshot();
});
