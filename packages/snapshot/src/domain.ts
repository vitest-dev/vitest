export interface DomainSnapshotContext {
  filepath: string
  name: string
  testId: string
}

export interface DomainMatchResult {
  pass: boolean
}

export interface DomainSnapshotAdapter<Captured = unknown, Expected = unknown, Options = unknown> {
  name: string
  capture: (
    received: unknown,
    context: DomainSnapshotContext,
    options?: Options,
  ) => Captured
  render: (
    captured: Captured,
    context: DomainSnapshotContext,
    mode: 'assert' | 'update',
    options?: Options,
  ) => string
  parseExpected?: (
    input: string,
    context: DomainSnapshotContext,
    options?: Options,
  ) => Expected
  match?: (
    captured: Captured,
    expected: Expected | string,
    context: DomainSnapshotContext,
    options?: Options,
  ) => DomainMatchResult
}
