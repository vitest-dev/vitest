---
title: Debugging | Guide
---

# Debugging

## Terminal

To debug a test file without an IDE, you can use [`ndb`](https://github.com/GoogleChromeLabs/ndb). Just add a `debugger` statement anywhere in your code, and then run `ndb`:

```sh
# install ndb globally
npm install -g ndb

# alternatively, with yarn
yarn global add ndb

# run tests with debugger enabled
ndb npm run test
```

## VSCode

Quick way to debug tests in VSCode is via `JavaScript Debug Terminal`. Open a new `JavaScript Debug Terminal` and run `npm run test` or `vitest` directly. *this works with any code ran in Node, so will work with most JS testing frameworks*

![image](https://user-images.githubusercontent.com/5594348/212169143-72bf39ce-f763-48f5-822a-0c8b2e6a8484.png)

You can also add a dedicated launch configuration to debug a test file in VSCode:

```json
{
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Current Test File",
      "autoAttachChildProcesses": true,
      "skipFiles": ["<node_internals>/**", "**/node_modules/**"],
      "program": "${workspaceRoot}/node_modules/vitest/vitest.mjs",
      "args": ["run", "${relativeFile}"],
      "smartStep": true,
      "console": "integratedTerminal"
    }
  ]
}
```

Then in the debug tab, ensure 'Debug Current Test File' is selected. You can then open the test file you want to debug and press F5 to start debugging.

## IntelliJ IDEA

Create a 'Node.js' run configuration. Use the following settings to run all tests in debug mode:

Setting | Value
 --- | ---
Working directory | /path/to/your-project-root
JavaScript file | ./node_modules/vitest/vitest.mjs
Application parameters | run --threads false

Then run this configuration in debug mode. The IDE will stop at JS/TS breakpoints set in the editor.
