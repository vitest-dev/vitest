---
title: name | Config
---

# name

- **Type:**

```ts
interface UserConfig {
  name?: string | { label: string; color?: LabelColor }
}
```

Assign a custom name to the test project or Vitest process. The name will be visible in the CLI and UI, and available in the Node.js API via [`project.name`](/api/advanced/test-project#name).

The color used by the CLI and UI can be changed by providing an object with a `color` property.

## Colors

The displayed colors depend on your terminal’s color scheme. In the UI, colors match their CSS equivalents.

- black
- red
- green
- yellow
- blue
- magenta
- cyan
- white

## Example

::: code-group
```js [string]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit',
  },
})
```
```js [object]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: {
      label: 'unit',
      color: 'blue',
    },
  },
})
```
:::

This property is mostly useful if you have several projects as it helps distinguish them in your terminal:

```js{7,11} [vitest.config.js]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        name: 'unit',
        include: ['./test/*.unit.test.js'],
      },
      {
        name: 'e2e',
        include: ['./test/*.e2e.test.js'],
      },
    ],
  },
})
```

::: tip
Vitest automatically assigns a name when none is provided. Resolution order:

- If the project is specified by a config file or directory, Vitest uses the package.json's `name` field.
- If there is no `package.json`, Vitest falls back to the project folder's basename.
- If the project is defined inline in the `projects` array (an object), Vitest assigns a numeric name equal to that project's array index (0-based).
:::

::: warning
Note that projects cannot have the same name. Vitest will throw an error during the config resolution.
:::

You can also assign different names to different browser [instances](/config/browser/instances):

```js{10,11} [vitest.config.js]
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        { browser: 'chromium', name: 'Chrome' },
        { browser: 'firefox', name: 'Firefox' },
      ],
    },
  },
})
```

::: tip
Browser instances inherit their parent project's name with the browser name appended in parentheses. For example, a project named `browser` with a chromium instance will be shown as `browser (chromium)`.

If the parent project has no name, or instances are defined at the root level (not inside a named project), the instance name defaults to the browser value (e.g. `chromium`). To override this behavior, set an explicit `name` on the instance.
:::
