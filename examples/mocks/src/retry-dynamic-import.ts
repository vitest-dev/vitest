export async function retryDynamicImport() {
  let retryTimes = 0
  const load = async () => {
    try {
      return await import('./dynamic-module.js')
    }
    catch (e) {
      if (retryTimes === 3)
        throw new Error('import dynamic module failed.')
      retryTimes += 1
      return await load()
    }
  }

  return await load()
}
