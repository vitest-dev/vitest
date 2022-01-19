import { Vitest } from '../../../packages/vitest/src/node'
import { StateManager } from '../../../packages/vitest/src/node/state'
import { ResolvedConfig } from '../../../packages/vitest/src/types'

interface Context {
  vitest: Vitest,
  output: string
}

export function getContext(): Context {
  let output = ''
  const log = (text: string) => output += text + '\n'

  const config: Partial<ResolvedConfig> = {

  }

  const state: Partial<StateManager> = {

  }

  const context: Partial<Vitest> = {
    log,
    state: state as StateManager,
    config: config as ResolvedConfig
  }

  return {
    vitest: context as Vitest,
    get output() {
      return output
    }
  }
}
