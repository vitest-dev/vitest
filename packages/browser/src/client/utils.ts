export async function importId(id: string, basePath: string) {
  const name = `${basePath}@id/${id}`
  // @ts-expect-error mocking vitest apis
  return __vi_wrap_module__(import(name))
}
