import { expect, test } from "vitest";
import { runVitest } from "../../test-utils";
import fs from "node:fs"
import path from "node:path"

test("fs cache", async () => {
  // ensure removed
  const root = path.resolve("fixtures/fs-cached-check")
  await fs.promises.rm(path.join(root, "dist"), { recursive: true, force: true })

  const { stderr, exitCode } = await runVitest(
    {
      root,
    },
    undefined,
    undefined,
    {
      server: {
        fs: {
          cachedChecks: false,
        },
      },
    },
  );
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
});
