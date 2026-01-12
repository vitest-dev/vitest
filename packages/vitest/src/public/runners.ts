export { NodeBenchmarkRunner } from '../runtime/runners/benchmark'
export { TestRunner as VitestTestRunner } from '../runtime/runners/test'
export type { VitestRunner } from '@vitest/runner'

console.warn('Importing from "vitest/runners" is deprecated since Vitest 4.1. Please use "vitest" instead.')
