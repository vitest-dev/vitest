import { existsSync } from 'node:fs'
import { resolve } from 'pathe'
import { configFiles } from '../../constants'

export function findLocalConfig(root: string): string | undefined {
  for (const configFile of configFiles) {
    const configPath = resolve(root, configFile)
    if (existsSync(configPath)) {
      return configPath
    }
  }
}
