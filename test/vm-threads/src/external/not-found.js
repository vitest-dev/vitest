export async function importExternal() {
  await import('@vitest/non-existing-package')
}

export async function importInternal() {
  await import('./non-existing-path')
}
