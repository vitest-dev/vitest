export interface DomainSnapshotContext {
  filepath: string
  name: string
  testId: string
}

export interface DomainMatchResult {
  pass: boolean
  message?: string
  expected?: string
  actual?: string
  mergedExpected?: string
}

// TODO: is context/options needed or slop?
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
    options?: Options,
  ) => string
  parseExpected: (
    input: string,
    context: DomainSnapshotContext,
    options?: Options,
  ) => Expected
  match: (
    captured: Captured,
    expected: Expected,
    context: DomainSnapshotContext,
    options?: Options,
  ) => DomainMatchResult
}

const domains = new Map<string, DomainSnapshotAdapter<any, any, any>>()

export function addDomain<Captured = unknown, Expected = unknown, Options = unknown>(
  adapter: DomainSnapshotAdapter<Captured, Expected, Options>,
): void {
  domains.set(adapter.name, adapter)
}

export function getDomain(name: string): DomainSnapshotAdapter<any, any, any> | undefined {
  return domains.get(name)
}
