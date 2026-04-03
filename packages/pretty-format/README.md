# @vitest/pretty-format

[![NPM version](https://img.shields.io/npm/v/@vitest/pretty-format?color=a1b858&label=)](https://npmx.dev/package/@vitest/pretty-format)

Vitest's fork of `pretty-format`, published as an ESM-only package.

This package powers several formatting paths in Vitest:

- snapshot serialization
- assertion diff rendering
- matcher and error messages
- browser `prettyDOM` output

[GitHub](https://github.com/vitest-dev/vitest/tree/main/packages/pretty-format) | [Documentation](https://vitest.dev/)

## Usage

```ts
import { format } from '@vitest/pretty-format'

const value = {
  user: 'Ada',
  items: [1, 2, 3],
}

console.log(format(value, {
  printBasicPrototype: false,
}))
```

## Package Defaults

The package-level defaults are:

- `callToJSON: true`
- `compareKeys: undefined`
- `escapeRegex: false`
- `escapeString: true`
- `highlight: false`
- `indent: 2`
- `maxDepth: Infinity`
- `maxOutputLength: 1_000_000`
- `min: false`
- `plugins: []`
- `printBasicPrototype: true`
- `printFunctionName: true`
- `printShadowRoot: true`

Important:

- `plugins: []` means the package does not auto-enable its built-in plugins by default
- Vitest features opt into their own plugin stacks and option presets

## Built-in Plugins

The package exports these built-in plugins:

- `ReactTestComponent`
- `ReactElement`
- `DOMElement`
- `DOMCollection`
- `Immutable`
- `AsymmetricMatcher`
- `Error`

You can use them directly with `format(..., { plugins })`:

```ts
import { format, plugins } from '@vitest/pretty-format'

console.log(format(document.body, {
  plugins: [plugins.DOMElement, plugins.DOMCollection],
}))
```

## Vitest Extensions

Besides the inherited `pretty-format` API surface, Vitest currently adds and documents these notable behaviors:

### `printShadowRoot`

Controls whether DOM serialization includes shadow-root contents.

```ts
format(element, {
  printShadowRoot: false,
})
```

### `maxOutputLength`

Approximate per-depth output budget used to prevent pathological expansion of large recursive structures.

This is a heuristic safety valve, not a hard cap on the final string length.

```ts
format(value, {
  maxOutputLength: 100_000,
})
```

## How Vitest Uses It

Vitest does not use one global formatter preset everywhere.

### Snapshots

Snapshots use `@vitest/pretty-format` with snapshot-specific defaults such as:

- `printBasicPrototype: false`
- `escapeString: false`
- `escapeRegex: true`
- `printFunctionName: false`

Default snapshot plugin stack:

- `ReactTestComponent`
- `ReactElement`
- `DOMElement`
- `DOMCollection`
- `Immutable`
- `AsymmetricMatcher`
- `MockSerializer`

Snapshot formatting is configured through [`test.snapshotFormat`](https://vitest.dev/config/snapshotformat), while serializer registration goes through [`expect.addSnapshotSerializer`](https://vitest.dev/api/expect#expect-addsnapshotserializer) or [`snapshotSerializers`](https://vitest.dev/config/snapshotserializers).

### Diffs

Assertion diffs use a different preset and plugin stack.

Default diff plugins:

- `ReactTestComponent`
- `ReactElement`
- `DOMElement`
- `DOMCollection`
- `Immutable`
- `AsymmetricMatcher`
- `Error`

### General Message Formatting

Matcher and error messages commonly go through Vitest's general stringify utilities, which use:

- `ReactTestComponent`
- `ReactElement`
- `DOMElement`
- `DOMCollection`
- `Immutable`
- `AsymmetricMatcher`

### Browser `prettyDOM`

Browser `prettyDOM` builds on the general stringify path and enables browser-oriented defaults such as:

- `highlight: true`
- `maxLength: 7000`

It can also replace the default DOM plugin with a filtered variant when `filterNode` is configured.

## Notes for `snapshotFormat`

The package API accepts `plugins`, but Vitest intentionally ignores `test.snapshotFormat.plugins`.

If you need custom snapshot serialization in Vitest:

- use `expect.addSnapshotSerializer`
- or use `snapshotSerializers`

## Compatibility

This package is forked from Jest's `pretty-format`, but Vitest documents its behavior independently because Vitest-specific defaults and extensions differ by feature.
