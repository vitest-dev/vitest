import type { Vitest } from 'vitest/node'

const getCircularReplacer = () => {
  const seen = new WeakSet()
  return (key: any, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value))
        return value.id

      seen.add(value)
    }
    return value
  }
}

export const getSuitesAsJson = (vitest: Vitest) => {
  const files = vitest.state.getFiles()

  return JSON.stringify(files, getCircularReplacer())
}
