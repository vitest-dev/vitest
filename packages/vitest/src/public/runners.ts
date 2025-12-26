export { NodeBenchmarkRunner } from '../runtime/runners/benchmark'
export { VitestTestRunner } from '../runtime/runners/test'
export type { VitestRunner } from '@vitest/runner'

process.emitWarning('Importing from "vitest/runners" is deprecated since Vitest 4.1. Please use "vitest/runtime" instead.', 'DeprecationWarning')
