// it's possible that import was not optimized yet
async function tryImport(id: string, tries = 20): Promise<any> {
  try {
    return await import(id)
  }
  catch (cause) {
    if (tries <= 0) {
      location.reload()
      throw new Error(`Failed to import ${id}.`, { cause })
    }

    await new Promise(resolve => setTimeout(resolve, 0))
    return await tryImport(id, tries - 1)
  }
}

export async function importId(id: string) {
  const name = `/@id/${id}`
  // TODO: this import _should_ always work, but sometimes it doesn't
  // this is a workaround until we can properly debug it - maybe server is not ready?
  // @ts-expect-error mocking vitest apis
  return __vi_wrap_module__(tryImport(name))
}
