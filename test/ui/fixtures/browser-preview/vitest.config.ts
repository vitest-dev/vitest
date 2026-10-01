import { preview } from "@vitest/browser-preview";
import { defineConfig, Plugin } from "vitest/config";
import type { Vitest } from "vitest/node";

// run preview provider on headless playwright
// PREVIEW_PLAYWRIGHT=true pnpm -C test/ui test-fixtures --root fixtures/browser-preview
// PREVIEW_PLAYWRIGHT=headless pnpm -C test/ui test-fixtures --root fixtures/browser-preview

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      traceView: true,
      headless: false,
      ui: true,
      provider: preview(),
      instances: [{ browser: "chromium" }],
    },
  },
  plugins: [
    customPreviewPlugin(),
  ],
});

declare global {
  var __hackVitest: Vitest;
  var __hackOpenBrowser: ((url: string) => void) | undefined;
}

function customPreviewPlugin(): Plugin {
  async function handlePreviewPlaywright(url: string) {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch({
      headless: process.env.PREVIEW_PLAYWRIGHT === 'headless',
    });
    globalThis.__hackVitest.onClose(async () => {
      await browser.close();
    })
    const page = await browser.newPage();
    await page.goto(url);
  }

  return {
    name: "custom-preview",
    configureVitest(context) {
      // pass vitest instance through globalThis
      // since this config/plugin is loaded twice
      // as main vite server and as browser mode vite server
      globalThis.__hackVitest = context.vitest;
    },
    configureServer(server) {
      const overrideOpenBrowser =
        process.env.PREVIEW_PLAYWRIGHT
        ? handlePreviewPlaywright
        : globalThis.__hackOpenBrowser;
      if (overrideOpenBrowser) {
        server.openBrowser = () => {
          const url = server.config.server.open;
          if (typeof url !== "string") {
            throw new Error(`Invalid preview url ${url}`);
          }
          overrideOpenBrowser(url);
        };
      }
    },
  }
}
