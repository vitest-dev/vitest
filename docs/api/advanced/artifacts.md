---
outline: deep
title: Test Artifacts
---

# Test Artifacts <Advanced /> <Version type="experimental">4.0.11</Version> <Experimental />

::: warning
This is an advanced API. As a user, you most likely want to use [test annotations](/guide/test-annotations) to add notes or context to your tests instead. This is primarily used internally and by library authors.
:::

Test artifacts allow attaching or recording structured data, files, or metadata during test execution. This is a low-level feature primarily designed for:

- Internal use ([`annotate`](/guide/test-annotations) is built on top of the artifact system)
- Framework authors creating custom testing tools on top of Vitest

Each artifact includes:

- A type discriminator which is a unique identifier for the artifact type
- Custom data, can be any relevant information
- Optional attachments, either files or inline content associated with the artifact
- A source code location indicating where the artifact was created

Vitest automatically manages attachment serialization (files are copied to [`attachmentsDir`](/config/attachmentsdir)) and injects source location metadata, so you can focus on the data you want to record. All artifacts **must** extend from [`TestArtifactBase`](#testartifactbase) and all attachments from [`TestAttachment`](#testattachment) to be correctly handled internally.

## API

### `recordArtifact` <Experimental /> {#recordartifact}

::: warning
`recordArtifact` is an experimental API. Breaking changes might not follow SemVer, please pin Vitest's version when using it.

The API surface may change based on feedback. We encourage you to try it out and share your experience with the team.
:::

```ts
function recordArtifact<Artifact extends TestArtifact>(task: Test, artifact: Artifact): Promise<Artifact>
```

The `recordArtifact` function records an artifact during test execution and returns it. It expects a [task](/api/advanced/runner#tasks) as the first parameter and an object assignable to [`TestArtifact`](#testartifact) as the second.

::: info
Artifacts must be recorded before the task is reported. Any artifacts recorded after that will not be included in the task.
:::

When an artifact is recorded on a test, it emits an `onTestArtifactRecord` runner event and a [`onTestCaseArtifactRecord` reporter event](/api/advanced/reporters#ontestcaseartifactrecord). To retrieve recorded artifacts from a test case, use the [`artifacts()`](/api/advanced/test-case#artifacts) method.

Note: annotations, [even though they're built on top of this feature](#relationship-with-annotations), won't appear in the `task.artifacts` array for backwards compatibility reasons until the next major version.

### `TestArtifact`

The `TestArtifact` type is a union containing all artifacts Vitest can produce, including custom ones. All artifacts extend from [`TestArtifactBase`](#testartifactbase)

### `TestArtifactBase` <Experimental /> {#testartifactbase}

```ts
export interface TestArtifactBase {
  /** File or data attachments associated with this artifact */
  attachments?: TestAttachment[]
  /** Source location where this artifact was created */
  location?: TestArtifactLocation
}
```

The `TestArtifactBase` interface is the base for all test artifacts.

Extend this interface when creating custom test artifacts. Vitest automatically manages the `attachments` array and injects the `location` property to indicate where the artifact was created in your test code.

::: danger
When running with [`api.allowWrite`](/config/api#api-allowwrite) or [`browser.api.allowWrite`](/config/browser/api#api-allowwrite) disabled, Vitest empties the `attachments` array on every artifact before reporting it.

If your custom artifact narrows the `attachments` type (e.g. to a tuple), include `| []` in the union so the type reflects what actually happens at runtime.
:::

### `TestAttachment`

```ts
export interface TestAttachment {
  /** MIME type of the attachment (e.g., 'image/png', 'text/plain') */
  contentType?: string
  /** File system path to the attachment */
  path?: string
  /** Inline attachment content as a string or raw binary data */
  body?: string | Uint8Array
}
```

The `TestAttachment` interface represents a file or data attachment associated with a test artifact.

Attachments can be either file-based (via `path`) or inline content (via `body`). The `contentType` helps consumers understand how to interpret the attachment data.

### `TestArtifactLocation`

```ts
export interface TestArtifactLocation {
  /** Line number in the source file (1-indexed) */
  line: number
  /** Column number in the line (1-indexed) */
  column: number
  /** Path to the source file */
  file: string
}
```

The `TestArtifactLocation` interface represents the source code location information for a test artifact. It indicates where in the source code the artifact originated from.

### `TestArtifactRegistry`

The `TestArtifactRegistry` interface is a registry for custom test artifact types.

Augmenting this interface using [TypeScript's module augmentation feature](https://typescriptlang.org/docs/handbook/declaration-merging#module-augmentation) allows registering custom artifact types that tests can produce.

Each custom artifact should extend [`TestArtifactBase`](#testartifactbase) and include a unique `type` discriminator property.

Here are a few guidelines or best practices to follow:

- Try using a `Symbol` as the **registry key** to guarantee uniqueness
- The `type` property should follow the pattern `'package-name:artifact-name'`, **`'internal:'` is a reserved prefix**
- Use `attachments` to include files or data; extend [`TestAttachment`](#testattachment) for custom metadata
- If you narrow the `attachments` type (e.g. to a tuple), include `| []` in the union since Vitest may empty the array at runtime (see [`TestArtifactBase`](#testartifactbase))
- `location` property is automatically injected

## Custom Artifacts

To use and manage artifacts in a type-safe manner, you need to create its type and register it:

```ts
import type { TestArtifactBase, TestAttachment } from 'vitest'

interface A11yReportAttachment extends TestAttachment {
  contentType: 'text/html'
  path: string
}

interface AccessibilityArtifact extends TestArtifactBase {
  type: 'a11y:report'
  passed: boolean
  wcagLevel: 'A' | 'AA' | 'AAA'
  attachments: [A11yReportAttachment] | []
}

const a11yReportKey = Symbol('report')

declare module 'vitest' {
  interface TestArtifactRegistry {
    [a11yReportKey]: AccessibilityArtifact
  }
}
```

As long as the types are assignable to their bases and don't have errors, everything should work fine and you should be able to record artifacts using [`recordArtifact`](#recordartifact):

```ts
async function toBeAccessible(
  this: MatcherState,
  actual: Element,
  wcagLevel: 'A' | 'AA' | 'AAA' = 'AA'
): AsyncExpectationResult {
  const report = await runAccessibilityAudit(actual, wcagLevel)

  await recordArtifact(this.task, {
    type: 'a11y:report',
    passed: report.violations.length === 0,
    wcagLevel,
    attachments: [{
      contentType: 'text/html',
      path: report.path,
    }],
  })

  return {
    pass: violations.length === 0,
    message: () => `Found ${report.violations.length} accessibility violation(s)`
  }
}
```

## Relationship with Annotations

Test annotations are built on top of the artifact system. When using annotations in tests, they create `internal:annotation` artifacts under the hood. However, annotations are:

- Simpler to use
- Designed for end-users, not developers

Use annotations if you just want to add notes to your tests. Use artifacts if you need custom data.
