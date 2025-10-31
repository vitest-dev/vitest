# @vitest/pretty-format

Vitest's fork of `pretty-format` for serializing JavaScript values into a human-readable string format. This package is primarily used by Vitest for snapshot testing and displaying test results.

## Installation

```bash
npm install @vitest/pretty-format
```

## Usage

The main export is the `format` function, which takes any JavaScript value and converts it to a formatted string:

```js
import { format } from '@vitest/pretty-format'

const value = {
  name: 'John',
  age: 30,
  hobbies: ['reading', 'coding'],
}

console.log(format(value))
// Output:
// Object {
//   "name": "John",
//   "age": 30,
//   "hobbies": Array [
//     "reading",
//     "coding",
//   ],
// }
```

## Options

You can customize the formatting behavior by passing options:

```js
import { format } from '@vitest/pretty-format'

const value = { foo: 'bar', nested: { value: 123 } }

console.log(format(value, {
  indent: 4,              // Number of spaces for indentation (default: 2)
  maxDepth: 2,            // Maximum depth to print (default: Infinity)
  min: true,              // Print without whitespace (default: false)
  printBasicPrototype: false, // Print [[Prototype]]: Object/Array on basic objects (default: false)
}))
```

### Available Options

- `callToJSON` - Call `toJSON()` method if available (default: `true`)
- `compareKeys` - Function to sort object keys
- `escapeRegex` - Escape special characters in regular expressions (default: `false`)
- `escapeString` - Escape special characters in strings (default: `true`)
- `highlight` - Highlight syntax with colors (default: `false`)
- `indent` - Number of spaces for indentation (default: `2`)
- `maxDepth` - Maximum depth to traverse (default: `Infinity`)
- `maxWidth` - Maximum line width (default: `80`)
- `min` - Print without whitespace (default: `false`)
- `plugins` - Array of plugins to handle custom types
- `printBasicPrototype` - Print prototype on basic objects (default: `false`)
- `printFunctionName` - Print function names (default: `true`)
- `theme` - Color theme for syntax highlighting

## Plugins

The package includes built-in plugins for formatting common types:

```js
import { format, plugins } from '@vitest/pretty-format'

// Available plugins:
// - AsymmetricMatcher: Format Jest/Vitest asymmetric matchers
// - DOMCollection: Format DOM node collections
// - DOMElement: Format DOM elements
// - Immutable: Format Immutable.js data structures
// - ReactElement: Format React elements
// - ReactTestComponent: Format React test components
// - Error: Format Error objects

const element = document.createElement('div')
element.className = 'container'

console.log(format(element, {
  plugins: [plugins.DOMElement]
}))
// Output: <div class="container" />
```

### Custom Plugins

You can create custom plugins to handle specific types:

```js
import { format } from '@vitest/pretty-format'

const myPlugin = {
  test(val) {
    return val && val.isCustomType === true
  },
  serialize(val, config, indentation, depth, refs, printer) {
    return `CustomType { value: ${printer(val.value, config, indentation, depth, refs)} }`
  }
}

const customValue = { isCustomType: true, value: 42 }
console.log(format(customValue, { plugins: [myPlugin] }))
// Output: CustomType { value: 42 }
```

## Differences from Jest's pretty-format

This is a fork of Jest's `pretty-format` with the following changes:

- **ESM Support**: Full support for ES modules
- **Updated Dependencies**: Uses `tinyrainbow` for colors instead of `ansi-styles`
- **Default Options**: `printBasicPrototype` defaults to `false` for cleaner output

## Use in Vitest

This package is used internally by Vitest for:
- Snapshot testing serialization
- Displaying assertion differences
- Formatting test output

When using Vitest's snapshot testing, you can customize the formatting through the [`snapshotFormat`](/config/#snapshotformat) configuration option.

## License

MIT

Based on [pretty-format](https://github.com/facebook/jest/tree/main/packages/pretty-format) from Jest.
