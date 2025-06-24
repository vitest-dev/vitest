import type { TestProject } from 'vitest/node'

export function setup({ provide }: TestProject) {
  provide('globalSetupOverridden', true)
}
