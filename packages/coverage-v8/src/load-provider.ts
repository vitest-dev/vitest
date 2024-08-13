// to not bundle the provider
const name = './provider.js'

export async function loadProvider() {
  const { V8CoverageProvider } = (await import(/* @vite-ignore */ name)) as typeof import('./provider')

  return new V8CoverageProvider()
}
