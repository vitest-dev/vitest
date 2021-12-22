// import { getSuites } from '../../../src/utils'

import { getSuites } from '../../vitest/src/utils'
import type { Vitest } from '../../vitest/src/node'

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
