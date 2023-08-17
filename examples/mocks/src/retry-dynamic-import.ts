export async function retryDynamicImport() {
  let retryTimes = 0
  const load = async () => {
    try { // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      return await import('./dynamic-module')
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
