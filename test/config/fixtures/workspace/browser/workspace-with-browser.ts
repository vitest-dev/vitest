import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "Browser project",
      browser: {
         enabled: true,
         provider: 'webdriverio',
         instances: [{ browser: 'chrome' }]
      },
    }
  }
])