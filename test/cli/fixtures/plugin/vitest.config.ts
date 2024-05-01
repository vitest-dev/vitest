import { defineConfig } from 'vitest/config'

const testHooks: string[] = (globalThis as any).__testHooks ??= [];

export default defineConfig({
  plugins: [
    {
      name: "test-default",
      configureServer() {
        testHooks.push("configureServer(default)")
        console.log("configureServer(default)")
      },
      buildStart() {
        testHooks.push("buildStart(default)")
        console.log("buildStart(default)")
      },
      resolveId(source) {
        testHooks.push("resolveId(default)")
        console.log("resolveId(default)", source)
      },
      transform(_code, id) {
        testHooks.push("transform(default)")
        console.log("transform(default)", id)
      },
    },
    {
      name: "test-pre",
      enforce: "pre",
      configureServer() {
        testHooks.push("configureServer(pre)")
        console.log("configureServer(pre)")
      },
      buildStart() {
        testHooks.push("buildStart(pre)")
        console.log("buildStart(pre)")
      },
      resolveId(source) {
        testHooks.push("resolveId(pre)")
        console.log("resolveId(pre)", source)
      },
      transform(_code, id) {
        testHooks.push("transform(pre)")
        console.log("transform(pre)", id)
      },
    }
  ]
})
