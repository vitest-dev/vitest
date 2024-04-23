// @ts-check

export function cwdPlugin(name) {
  return {
    name: `vitest:test:workspace-${name}`,
    configResolved() {
      process.env[`${name}_CWD_CONFIG`] = process.cwd()
    },
    configureServer() {
      process.env[`${name}_CWD_SERVER`] = process.cwd()
    },
  }
}
