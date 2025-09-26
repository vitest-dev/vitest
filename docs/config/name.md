# name

- **Type:** `string | { label: string, color?: LabelColor }`

Assign a custom name to the test project or Vitest process. The name will be visible in the CLI and UI, and available in the Node.js API via [`project.name`](/advanced/api/test-project#name).

Color used by CLI and UI can be changed by providing an object with `color` property.
