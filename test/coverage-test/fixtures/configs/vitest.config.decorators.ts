import { defineConfig, mergeConfig } from "vitest/config";
import swc from "unplugin-swc";
import type { Plugin } from "vite";

import base from "./vitest.config";

export default mergeConfig(
  base,
  defineConfig({
    plugins: [DecoratorsPlugin()],
    test: {},
  })
);

function DecoratorsPlugin(): Plugin {
  const plugin = swc.vite({
    jsc: {
      target: "esnext",
      parser: {
        syntax: "typescript",
        decorators: true,
      },
      transform: {
        legacyDecorator: true,
        decoratorMetadata: true,
      },
    },
  });

  return {
    name: "custom-swc-decorator",
    enforce: "pre",
    transform(code, id, options) {
      if (id.endsWith("decorators.ts")) {
        // @ts-expect-error -- Ignore complex type
        return plugin.transform(code, id, options);
      }
    },
  };
}
