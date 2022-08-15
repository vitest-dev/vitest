export * from './takeCoverage'

export async function getProvider() {
  const { C8CoverageProvider } = await import('./provider')
  return new C8CoverageProvider()
}
