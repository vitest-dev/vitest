export async function retryDynamicImport() {
  let retryTimes = 0
  const load = async (): Promise<unknown> => {
    try {
      return await import('./dynamic-module')
    }
    catch {
      if (retryTimes === 3) {
        throw new Error('import dynamic module failed.')
      }
      retryTimes += 1
      return await load()
    }
  }

  return await load()
}
