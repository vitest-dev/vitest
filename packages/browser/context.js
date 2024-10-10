// Vitest resolves "@vitest/browser/context" as a virtual module instead

// fake exports for static analysis
export const page = null
export const server = null
export const userEvent = null
export const cdp = null
export const commands = null

const pool = globalThis.__vitest_worker__?.ctx?.pool

throw new Error(
  // eslint-disable-next-line prefer-template
  '@vitest/browser/context can be imported only inside the Browser Mode. '
  + (pool
    ? `Your test is running in ${pool} pool. Make sure your regular tests are excluded from the "test.include" glob pattern.`
    : 'Instead, it was imported outside of Vitest.'),
)
