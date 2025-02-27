import type { V8CoverageProvider } from './provider'

// to not bundle the provider
const name = './provider.js'

export async function loadProvider(): Promise<V8CoverageProvider> {
  const { V8CoverageProvider } = (await import(/* @vite-ignore */ name)) as typeof import('./provider')

  return new V8CoverageProvider()
}
