export async function importPackage() {
  await import('@vitest/non-existing-package')
}

export async function importPath() {
  await import('./non-existing-path')
}

export async function importBuiltin() {
  await import('node:non-existing-builtin')
}

export async function importNamespace() {
  await import('non-existing-namespace:xyz')
}
