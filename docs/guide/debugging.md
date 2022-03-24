# Debugging

## VSCode

To debug a test file in VSCode, create the following launch configuration.

```json
{
    // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
    "version": "0.2.0",
    "configurations": [
        {
            "type": "pwa-node",
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

Then in the debug tab ensure 'Debug Current Test File' is selected, you can then open the test file you want to debug and press F5 to start debugging.

## IntelliJ IDEA

Create a 'Node.js' run configuration. Use the following settings to run all tests in debug mode:

Setting | Value
 --- | ---
Working directory | C:\path\to\your-project-root
JavaScript file | .\node_modules\vitest\vitest.mjs
Application parameters | run --threads false

Then run this configuration in debug mode. The IDE will stop at JS/TS breakpoints set in the editor.
