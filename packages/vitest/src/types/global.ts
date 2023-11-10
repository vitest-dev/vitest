import type { Plugin as PrettyFormatPlugin } from 'pretty-format'
import type { SnapshotState } from '@vitest/snapshot'
import type { ExpectStatic } from '@vitest/expect'
import type { UserConsoleLog } from './general'
import type { VitestEnvironment } from './config'
import type { BenchmarkResult } from './benchmark'

declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace Chai {
    interface Assertion {
      containSubset(expected: any): Assertion
    }
    interface Assert {
      containSubset(val: any, exp: any, msg?: string): void
    }
  }
}

declare module '@vitest/expect' {
  interface MatcherState {
    environment: VitestEnvironment
    snapshotState: SnapshotState
  }

  interface ExpectStatic {
    addSnapshotSerializer(plugin: PrettyFormatPlugin): void
  }

  interface Assertion<T> {
    // Snapshots are extended in @vitest/snapshot and are not part of @vitest/expect
    matchSnapshot<U extends { [P in keyof T]: any }>(snapshot: Partial<U>, message?: string): void
    matchSnapshot(message?: string): void
    toMatchSnapshot<U extends { [P in keyof T]: any }>(snapshot: Partial<U>, message?: string): void
    toMatchSnapshot(message?: string): void
    toMatchInlineSnapshot<U extends { [P in keyof T]: any }>(properties: Partial<U>, snapshot?: string, message?: string): void
    toMatchInlineSnapshot(snapshot?: string, message?: string): void
    toThrowErrorMatchingSnapshot(message?: string): void
    toThrowErrorMatchingInlineSnapshot(snapshot?: string, message?: string): void
    toMatchFileSnapshot(filepath: string, message?: string): Promise<void>
  }
}

declare module '@vitest/runner' {
  interface TestContext {
    expect: ExpectStatic
  }

  interface TaskMeta {
    typecheck?: boolean
    benchmark?: boolean
  }

  interface File {
    prepareDuration?: number
    environmentLoad?: number
  }

  interface TaskBase {
    logs?: UserConsoleLog[]
  }

  interface TaskResult {
    benchmark?: BenchmarkResult
  }
}
