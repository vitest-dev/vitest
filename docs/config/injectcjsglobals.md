---
title: injectCjsGlobals | Config
---

# injectCjsGlobals

- **Type:** `boolean`
- **Default:** `true`
- **CLI:** `--no-inject-cjs-globals`, `--injectCjsGlobals=false`

Inject CommonJS module variables (`module`, `exports`, `require`, `__filename`, `__dirname`) into every module processed by Vitest.

By default, every file that Vitest transforms has access to these variables even if it is written using ESM syntax. This doesn't reflect how modules work in the wild: browsers do not support CommonJS variables, and Node.js doesn't expose them in ES modules.

To make the module environment stricter and closer to the target runtime, you can disable this behaviour:

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    injectCjsGlobals: false,
  },
})
```

When this option is disabled, only modules that are detected to be CommonJS receive these variables. CommonJS modules always keep them because they are part of the module scope, without them the module cannot be evaluated at all. The module type is detected the same way Node.js does it:

1. The file extension: `.cjs` and `.cts` files are always CommonJS, `.mjs` and `.mts` files are always ES modules.
2. The `type` field in the nearest `package.json`: `"module"` means ES module, `"commonjs"` means CommonJS. Same as in Node.js, the lookup stops at the first `package.json` and never crosses a `node_modules` boundary, so dependencies don't inherit the `type` of your project.
3. The presence of ESM syntax in the file: if the file has no static `import`/`export` declarations and doesn't reference `import.meta`, it is treated as CommonJS. Syntax inside comments and strings doesn't affect the detection. Dynamic imports are allowed in CommonJS modules, so they don't count as ESM syntax; type-only TypeScript imports are erased during the transform, so they don't count either.

The syntax detection is always enabled: Vitest doesn't respect Node.js CLI flags that modify the module type resolution, like `--no-experimental-detect-module`, `--input-type` (it only applies to the string input in Node.js), or the `--experimental-default-type` flag removed in Node.js 23.

Referencing a CommonJS variable in an ES module throws a `ReferenceError`, just like outside of Vitest:

```
ReferenceError: __dirname is not defined

"__dirname" is a CommonJS variable that is not available in ES modules, and "injectCjsGlobals" is disabled. If this module is meant to be an ES module, use "import.meta.dirname" instead of "__dirname". If it is meant to be a CommonJS module, use the ".cjs" file extension, set "type": "commonjs" in the nearest package.json, or externalize it with "server.deps.external".
```

::: warning
This option doesn't affect externalized modules which are always executed by the native runtime. Node.js provides CommonJS variables to externalized CommonJS modules on its own.

Note that inlined CommonJS modules are not processed by Vite plugins even when this option is enabled: `require` calls always leave the module runner, so features like mocking do not apply to them.
:::
