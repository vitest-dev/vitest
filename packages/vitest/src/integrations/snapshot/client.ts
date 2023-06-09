import { equals, iterableEquality, subsetEquality } from '@vitest/expect'
import { SnapshotClient } from '@vitest/snapshot'

export class VitestSnapshotClient extends SnapshotClient {
  equalityCheck(received: unknown, expected: unknown): boolean {
    return equals(received, expected, [iterableEquality, subsetEquality])
  }
}
