export interface NodeEnvironmentOptions {
  /**
   * Should Vitest follow Node.js rules about ESM/CJS interop.
   * TODO: extend description
   *
   * 1. CJS module will be parsed to find exports instead of using `Object.keys(module.exports)`.
   * 2. CJS module will not have interoped default export (can have default.default).
   *
   * @default false
   */
  strict?: boolean

  // don't provide ESM for CJS context, and vice versa - consider as a separate flag
  strictESM?: boolean
}
