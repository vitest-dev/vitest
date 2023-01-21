export const isNode: boolean = typeof process < 'u' && typeof process.stdout < 'u' && !process.versions?.deno && !globalThis.window
export const isBrowser: boolean = typeof window !== 'undefined'
