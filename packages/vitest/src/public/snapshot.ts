export { VitestNodeSnapshotEnvironment as VitestSnapshotEnvironment } from '../integrations/snapshot/environments/node'
export type { SnapshotEnvironment } from '@vitest/snapshot/environment'

process.emitWarning('Importing from "vitest/snapshot" is deprecated since Vitest 4.1. Please use "vitest/runtime" instead.', 'DeprecationWarning')
