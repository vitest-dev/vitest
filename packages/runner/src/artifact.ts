import type { Test, TestArtifact, TestArtifactBase /* used in JSDoc */, TestAttachment } from './types/tasks'
import { finishSendTasksUpdate } from './run'
import { getRunner } from './suite'
import { findTestFileStackTrace } from './utils/collect'

/**
 * @experimental
 * @advanced
 *
 * Records a custom test artifact during test execution.
 *
 * This function allows you to attach structured data, files, or metadata to a test.
 *
 * Vitest automatically injects the source location where the artifact was created and manages any attachments you include.
 *
 * @param task - The test task context, typically accessed via `this.task` in custom matchers or `context.task` in tests
 * @param artifact - The artifact to record. Must extend {@linkcode TestArtifactBase}
 *
 * @returns A promise that resolves to the recorded artifact with location injected
 *
 * @throws {Error} If called after the test has finished running
 * @throws {Error} If the test runner doesn't support artifacts
 *
 * @example
 * ```ts
 * // In a custom assertion
 * async function toHaveValidSchema(this: MatcherState, actual: unknown) {
 *   const validation = validateSchema(actual)
 *
 *   await recordArtifact(this.task, {
 *     type: 'my-plugin:schema-validation',
 *     passed: validation.valid,
 *     errors: validation.errors,
 *   })
 *
 *   return { pass: validation.valid, message: () => '...' }
 * }
 * ```
 */
export async function recordArtifact<Artifact extends TestArtifact>(task: Test, artifact: Artifact): Promise<Artifact> {
  const runner = getRunner()

  if (task.result && task.result.state !== 'run') {
    throw new Error(`Cannot record a test artifact outside of the test run. The test "${task.name}" finished running with the "${task.result.state}" state already.`)
  }

  const stack = findTestFileStackTrace(
    task.file.filepath,
    new Error('STACK_TRACE').stack!,
  )

  if (stack) {
    artifact.location = {
      file: stack.file,
      line: stack.line,
      column: stack.column,
    }

    if (artifact.type === 'internal:annotation') {
      artifact.annotation.location = artifact.location
    }
  }

  if (Array.isArray(artifact.attachments)) {
    for (const attachment of artifact.attachments) {
      manageArtifactAttachment(attachment)
    }
  }

  // annotations won't resolve as artifacts for backwards compatibility until next major
  if (artifact.type === 'internal:annotation') {
    return artifact
  }

  if (!runner.onTestArtifactRecord) {
    throw new Error(`Test runner doesn't support test artifacts.`)
  }

  await finishSendTasksUpdate(runner)

  const resolvedArtifact = await runner.onTestArtifactRecord(task, artifact)

  task.artifacts.push(resolvedArtifact)

  return resolvedArtifact as typeof artifact
}

const table: string[] = []
for (let i = 65; i < 91; i++) {
  table.push(String.fromCharCode(i)) // A-Z
}
for (let i = 97; i < 123; i++) {
  table.push(String.fromCharCode(i)) // a-z
}
for (let i = 0; i < 10; i++) {
  table.push(i.toString(10)) // 0-9
}
table.push('+', '/')

function encodeUint8Array(bytes: Uint8Array): string {
  let base64 = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i += 3) {
    if (len === i + 1) { // last 1 byte
      const a = (bytes[i] & 0xFC) >> 2
      const b = ((bytes[i] & 0x03) << 4)
      base64 += table[a]
      base64 += table[b]
      base64 += '=='
    }
    else if (len === i + 2) { // last 2 bytes
      const a = (bytes[i] & 0xFC) >> 2
      const b = ((bytes[i] & 0x03) << 4) | ((bytes[i + 1] & 0xF0) >> 4)
      const c = ((bytes[i + 1] & 0x0F) << 2)
      base64 += table[a]
      base64 += table[b]
      base64 += table[c]
      base64 += '='
    }
    else {
      const a = (bytes[i] & 0xFC) >> 2
      const b = ((bytes[i] & 0x03) << 4) | ((bytes[i + 1] & 0xF0) >> 4)
      const c = ((bytes[i + 1] & 0x0F) << 2) | ((bytes[i + 2] & 0xC0) >> 6)
      const d = bytes[i + 2] & 0x3F
      base64 += table[a]
      base64 += table[b]
      base64 += table[c]
      base64 += table[d]
    }
  }
  return base64
}

/**
 * Records an async operation associated with a test task.
 *
 * This function tracks promises that should be awaited before a test completes.
 * The promise is automatically removed from the test's promise list once it settles.
 */
export function recordAsyncOperation<T>(
  test: Test,
  promise: Promise<T>,
): Promise<T> {
  // if promise is explicitly awaited, remove it from the list
  promise = promise.finally(() => {
    if (!test.promises) {
      return
    }
    const index = test.promises.indexOf(promise)
    if (index !== -1) {
      test.promises.splice(index, 1)
    }
  })

  // record promise
  if (!test.promises) {
    test.promises = []
  }
  test.promises.push(promise)
  return promise
}

/**
 * Validates and prepares a test attachment for serialization.
 *
 * This function ensures attachments have either `body` or `path` set (but not both), and converts `Uint8Array` bodies to base64-encoded strings for easier serialization.
 *
 * @param attachment - The attachment to validate and prepare
 *
 * @throws {TypeError} If neither `body` nor `path` is provided
 * @throws {TypeError} If both `body` and `path` are provided
 */
export function manageArtifactAttachment(attachment: TestAttachment): void {
  if (attachment.body == null && !attachment.path) {
    throw new TypeError(`Test attachment requires "body" or "path" to be set. Both are missing.`)
  }
  if (attachment.body && attachment.path) {
    throw new TypeError(`Test attachment requires only one of "body" or "path" to be set. Both are specified.`)
  }
  // convert to a string so it's easier to serialise
  if (attachment.body instanceof Uint8Array) {
    attachment.body = encodeUint8Array(attachment.body)
  }
}
