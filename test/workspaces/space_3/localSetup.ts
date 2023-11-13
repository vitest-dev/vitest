import type { GlobalSetupContext } from 'vitest/node'

export function setup({ provide }: GlobalSetupContext) {
  provide('globalSetupOverriden', true)
}
