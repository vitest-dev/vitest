declare module 'concordance' {
  interface DisplayOptions {
    theme?: any
    maxDepth?: number
  }

  export function diff(expected: unknown, actual: unknown, options?: DisplayOptions): string
  export function formatDescriptor(descriptor: unknown, options?: DisplayOptions): string
}