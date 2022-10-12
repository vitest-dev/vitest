export const isNode = typeof process < 'u' && typeof process.stdout < 'u' && !process.versions?.deno && !globalThis.window
export const isBrowser = typeof window !== 'undefined'
