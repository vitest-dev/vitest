import { getSuites } from '../../../src/utils'

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

export const getSuitesAsJson = () => {
  // const vitest = process.__vitest__
  // const suites = getSuites(vitest.state.getFiles()).filter(x => x)

  // return JSON.stringify(suites, getCircularReplacer())
}
