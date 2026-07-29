export async function dynamicImport(name: string) {
  const pkg = await import(name)
  return pkg
}
