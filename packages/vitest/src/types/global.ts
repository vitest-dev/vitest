import type { ExpectStatic, PromisifyAssertion, Tester } from '@vitest/expect'
import type { Plugin as PrettyFormatPlugin } from '@vitest/pretty-format'
import type { SnapshotState } from '@vitest/snapshot'
import type { BenchmarkResult } from '../runtime/types/benchmark'
import type { UserConsoleLog } from './general'

declare global {
  // eslint-disable-next-line ts/no-namespace
  namespace Chai {
    interface ContainSubset {
      (expected: any): Assertion
    }

    interface Assertion {
      containSubset: ContainSubset
    }

    interface Assert {
      // eslint-disable-next-line ts/method-signature-style
      containSubset(val: any, exp: any, msg?: string): void
    }
  }
}

interface SnapshotMatcher<T> {
  <U extends { [P in keyof T]: any }>(
    snapshot: Partial<U>,
    hint?: string
  ): void
  (hint?: string): void
}

interface InlineSnapshotMatcher<T> {
  <U extends { [P in keyof T]: any }>(
    properties: Partial<U>,
    snapshot?: string,
    hint?: string
  ): void
  (hint?: string): void
}

declare module '@vitest/expect' {
  interface MatcherState {
    environment: string
    snapshotState: SnapshotState
  }

  interface ExpectPollOptions {
    interval?: number
    timeout?: number
    message?: string
  }

  interface ExpectStatic {
    unreachable: (message?: string) => never
    soft: <T>(actual: T, message?: string) => Assertion<T>
    poll: <T>(
      actual: () => T,
      options?: ExpectPollOptions
    ) => PromisifyAssertion<Awaited<T>>
    addEqualityTesters: (testers: Array<Tester>) => void
    assertions: (expected: number) => void
    hasAssertions: () => void
    addSnapshotSerializer: (plugin: PrettyFormatPlugin) => void
  }

  interface Assertion<T> {
    // Snapshots are extended in @vitest/snapshot and are not part of @vitest/expect
    matchSnapshot: SnapshotMatcher<T>
    toMatchSnapshot: SnapshotMatcher<T>
    toMatchInlineSnapshot: InlineSnapshotMatcher<T>

    /**
     * Checks that an error thrown by a function matches a previously recorded snapshot.
     *
     * @param hint - Optional custom error message.
     *
     * @example
     * expect(functionWithError).toThrowErrorMatchingSnapshot();
     */
    toThrowErrorMatchingSnapshot: (hint?: string) => void

    /**
     * Checks that an error thrown by a function matches an inline snapshot within the test file.
     * Useful for keeping snapshots close to the test code.
     *
     * @param snapshot - Optional inline snapshot string to match.
     * @param hint - Optional custom error message.
     *
     * @example
     * const throwError = () => { throw new Error('Error occurred') };
     * expect(throwError).toThrowErrorMatchingInlineSnapshot(`"Error occurred"`);
     */
    toThrowErrorMatchingInlineSnapshot: (
      snapshot?: string,
      hint?: string
    ) => void

    /**
     * Compares the received value to a snapshot saved in a specified file.
     * Useful for cases where snapshot content is large or needs to be shared across tests.
     *
     * @param filepath - Path to the snapshot file.
     * @param hint - Optional custom error message.
     *
     * @example
     * await expect(largeData).toMatchFileSnapshot('path/to/snapshot.json');
     */
    toMatchFileSnapshot: (filepath: string, hint?: string) => Promise<void>
  }
}

declare module '@vitest/runner' {
  interface TestContext {
    /**
     * `expect` instance bound to the current test.
     *
     * This API is useful for running snapshot tests concurrently because global expect cannot track them.
     */
    readonly expect: ExpectStatic
    /** @internal */
    _local: boolean
  }

  interface TaskMeta {
    typecheck?: boolean
    benchmark?: boolean
    failScreenshotPath?: string
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
