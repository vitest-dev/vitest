export { environments as builtinEnvironments } from '../integrations/env/index'
export { populateGlobal } from '../integrations/env/utils'
export type {
  Environment,
  EnvironmentReturn,
  VmEnvironmentReturn,
} from '../types/environment'

console.warn('Importing from "vitest/environments" is deprecated since Vitest 4.1. Please use "vitest/runtime" instead.')
