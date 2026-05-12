import path, { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      reportOnFailure: true,
    },
    tags: [{ name: "db" }, { name: "flaky" }],
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          root: path.join(import.meta.dirname, "node"),
          // TODO: https://github.com/vitest-dev/vitest/issues/10326
          attachmentsDir: path.join(import.meta.dirname, ".vitest/attachments"),
          environment: "happy-dom",
        },
      },
      {
        extends: true,
        test: {
          name: "browser",
          root: path.join(import.meta.dirname, "browser"),
          attachmentsDir: path.join(import.meta.dirname, ".vitest/attachments"),
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
            screenshotFailures: false,
            expect: {
              toMatchScreenshot: {
                resolveScreenshotPath: ({ root, testFileDirectory, arg, ext }) =>
                  resolve(root, testFileDirectory, `${arg}${ext}`),
              },
            },
          },
        },
      },
    ],
  },
});
