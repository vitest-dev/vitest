# @vitest/pretty-format

Vitest's fork of Jest's [`pretty-format`](https://npmx.dev/package/pretty-format), published as an ESM-only package.

This package powers several formatting paths in Vitest:

- snapshot serialization
- assertion diff rendering
- matcher and error messages
- browser `prettyDOM` output

## Usage

```ts
import { format } from '@vitest/pretty-format'

const value = {
  user: 'Ada',
  items: [1, 2, 3],
}

console.log(format(value))
/*
-- output --
Object {
  "items": Array [
    1,
    2,
    3,
  ],
  "user": "Ada",
}
*/
```

## Options

| key                   | type             | default     | notes                                                                |
| :-------------------- | :--------------- | :---------- | :------------------------------------------------------------------- |
| `callToJSON`          | `boolean`        | `true`      | Call `toJSON` if present                                             |
| `compareKeys`         | `function\|null` | `undefined` | Compare function for sorting object keys. Use `null` to skip sorting |
| `escapeRegex`         | `boolean`        | `false`     | Escape special characters in regular expressions                     |
| `escapeString`        | `boolean`        | `true`      | Escape special characters in strings                                 |
| `highlight`           | `boolean`        | `false`     | Highlight syntax with terminal colors                                |
| `indent`              | `number`         | `2`         | Spaces per indentation level                                         |
| `maxDepth`            | `number`         | `Infinity`  | Maximum depth to print                                               |
| `maxOutputLength`     | `number`         | `1_000_000` | Approximate per-depth output budget                                  |
| `maxWidth`            | `number`         | `Infinity`  | Maximum number of items to print in collections                      |
| `min`                 | `boolean`        | `false`     | Minimize added whitespace                                            |
| `plugins`             | `array`          | `[]`        | Plugins to serialize application-specific data types                 |
| `printBasicPrototype` | `boolean`        | `true`      | Print `Object` and `Array` prefixes for plain objects and arrays     |
| `printFunctionName`   | `boolean`        | `true`      | Include or omit the function name                                    |
| `printShadowRoot`     | `boolean`        | `true`      | Include shadow-root contents when formatting DOM nodes               |
| `quoteKeys`           | `boolean`        | `true`      | Always quote object property keys                                    |
| `singleQuote`         | `boolean`        | `false`     | Print strings using single quotes instead of double quotes           |
| `spacingInner`        | `string`         | `\n`        | Whitespace after commas between items or entries                     |
| `spacingOuter`        | `string`         | `\n`        | Whitespace just inside `[]` / `{}` delimiters                        |

Important:

- `plugins: []` means the package does not auto-enable its built-in plugins by default
- Vitest features opt into their own plugin stacks and option presets
- `min: true` also changes the defaults of other options to `spacingInner: ' '`, `spacingOuter: ''`, and `printBasicPrototype: false`

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

console.log(
  format(document.body, {
    plugins: [plugins.DOMElement, plugins.DOMCollection],
  }),
)
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

### Snapshots

Snapshots use `@vitest/pretty-format` with snapshot-specific defaults such as:

- `printBasicPrototype: false`
- `escapeString: false`
- `escapeRegex: true`
- `printFunctionName: false`
- `maxOutputLength: 2 ** 27`

Snapshots use a more generous safety cap than the package default. The default `maxOutputLength` is tuned for general-purpose formatting such as logs and error messages, while snapshot users may intentionally persist large serialized values to dedicated files. Users can still opt into a smaller cap through `test.snapshotFormat.maxOutputLength`.

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

### Vitest `stringify`

Matcher and error messages commonly go through Vitest's internal [`stringify`](https://github.com/vitest-dev/vitest/blob/59b0e6411be2b4aa5f2b339d02691aa83d5e403f/packages/utils/src/display.ts#L49) utility, which uses:

- `ReactTestComponent`
- `ReactElement`
- `DOMElement`
- `DOMCollection`
- `Immutable`
- `AsymmetricMatcher`

`stringify` also adds wrapper-level behavior on top of `@vitest/pretty-format`:

- `maxLength`: if the formatted output grows too large, `stringify` retries with a smaller `maxDepth` to keep the result bounded
- `filterNode`: swaps the default DOM plugin for a filtered variant so selected nodes are omitted from the output
- fallback on formatter errors: if formatting throws, `stringify` retries with `callToJSON: false`

### Browser `prettyDOM`

Browser `prettyDOM` builds on Vitest's `stringify` path and enables browser-oriented defaults such as:

- `highlight: true`

It can also replace the default DOM plugin with a filtered variant when `filterNode` is configured.
