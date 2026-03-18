export interface DomainMatchResult {
  pass: boolean
  message?: string
  expected?: string
  /**
   * See ivya's `matchAriaTree` for what `resolved` means
   * https://github.com/sheremet-va/ivya/pull/8
   */
  resolved?: string
}

export interface DomainSnapshotAdapter<Captured = unknown, Expected = unknown> {
  name: string
  capture: (received: unknown) => Captured
  render: (captured: Captured) => string
  parseExpected: (input: string) => Expected
  match: (captured: Captured, expected: Expected) => DomainMatchResult
}

const domains = new Map<string, DomainSnapshotAdapter<any, any>>()

export function addDomain<Captured = unknown, Expected = unknown>(
  adapter: DomainSnapshotAdapter<Captured, Expected>,
): void {
  domains.set(adapter.name, adapter)
}

export function getDomain(name: string): DomainSnapshotAdapter<any, any> | undefined {
  return domains.get(name)
}
