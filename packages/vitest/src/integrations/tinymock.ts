import { spy, spyOn } from 'tinyspy'

// TODO make jest compatible interface
export const vitest = {
  spyOn,
  fn: spy,
  mock: (path: string) => path,
}

export { spy, spyOn } from 'tinyspy'
