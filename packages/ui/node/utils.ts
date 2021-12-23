import type { Vitest } from 'vitest/node'
import { getSuites } from '../../vitest/src/utils'

const getCircularReplacer = () => {
  const seen = new WeakSet()
  return (key: any, value: any) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value))
        return

      seen.add(value)
    }
    return value
  }
}

export const getSuitesAsJson = (vitest: Vitest) => {
  const suites = getSuites(vitest.state.getFiles()).filter(x => x)

  return JSON.stringify(suites, getCircularReplacer())
}
