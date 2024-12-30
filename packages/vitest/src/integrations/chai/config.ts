import * as chai from 'chai'

export function setupChaiConfig(config: ChaiConfig) {
  Object.assign(chai.config, config)
}

export type ChaiConfig = Omit<
  Partial<typeof chai.config>,
  'useProxy' | 'proxyExcludedKeys'
>
