import path, { resolve } from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";
import type { BrowserCommand } from "vitest/node";
import fs from "node:fs"

const rmCommand: BrowserCommand<[filepath: string]> = async (ctx, filePath) => {
  const resolved = resolve(ctx.project.config.root, filePath)
  fs.rmSync(resolved, { recursive: true, force: true })
}

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
            commands: {
              rm: rmCommand,
            }
          },
        },
      },
    ],
  },
});
