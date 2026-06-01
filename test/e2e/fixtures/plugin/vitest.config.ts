import { defineConfig } from 'vitest/config'

function logHook(...args: unknown[]) {
  ((globalThis as any).__testHooks ??= []).push(args[0]);

  if (process.env["LOG_HOOK"]) {
    console.log(...args);
  }
}

export default defineConfig({
  plugins: [
    {
      name: "test-default",
      configureServer() {
        logHook("configureServer(default)")
      },
      buildStart() {
        logHook("buildStart(default)")
      },
      resolveId(source) {
        logHook("resolveId(default)", source)
      },
      transform(_code, id) {
        logHook("transform(default)", id)
      },
    },
    {
      name: "test-pre",
      enforce: "pre",
      configureServer() {
        logHook("configureServer(pre)")
      },
      buildStart() {
        logHook("buildStart(pre)")
      },
      resolveId(source) {
        logHook("resolveId(pre)", source)
      },
      transform(_code, id) {
        logHook("transform(pre)", id)
      },
    }
  ]
})
