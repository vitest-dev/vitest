export interface DomainSnapshotContext {
  filepath: string
  name: string
  testId: string
}

export interface DomainSnapshotMismatch {
  path: string
  reason: string
  expected?: string
  actual?: string
}

export interface DomainMatchResult {
  pass: boolean
  message?: string
  expected?: string
  actual?: string
  mismatches?: DomainSnapshotMismatch[]
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

const domains = new Map<string, DomainSnapshotAdapter<any, any, any>>()

export function addDomain<Captured = unknown, Expected = unknown, Options = unknown>(
  adapter: DomainSnapshotAdapter<Captured, Expected, Options>,
): void {
  domains.set(adapter.name, adapter)
}

export function getDomain(name: string): DomainSnapshotAdapter<any, any, any> | undefined {
  return domains.get(name)
}

export function getDomains(): DomainSnapshotAdapter<any, any, any>[] {
  return [...domains.values()]
}
