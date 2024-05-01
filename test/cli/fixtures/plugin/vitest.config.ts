import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [
    {
      name: "test-default",
      configureServer() {
        console.log("##test## configureServer(default)")
      },
      buildStart() {
        console.log("##test## buildStart(default)")
      },
      resolveId(source) {
        console.log("##test## resolveId(default)")
        console.log({ source })
      },
      transform(_code, id) {
        console.log("##test## transform(default)")
        console.log({ id })
      },
    },
    {
      name: "test-pre",
      enforce: "pre",
      configureServer() {
        console.log("##test## configureServer(pre)")
      },
      buildStart() {
        console.log("##test## buildStart(pre)")
      },
      resolveId(source) {
        console.log("##test## resolveId(pre)")
        console.log({ source })
      },
      transform(_code, id) {
        console.log("##test## transform(pre)")
        console.log({ id })
      },
    }
  ]
})
