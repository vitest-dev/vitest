---
title: outputFile | Config
outline: deep
---

# outputFile <CRoot /> {#outputfile}

- **Type:** `string | Record<string, string>`
- **CLI:** `--outputFile=<path>`, `--outputFile.json=./path`

Write test results to a file when the `--reporter=json` or `--reporter=junit` option is also specified.
By providing an object instead of a string you can define individual outputs when using multiple reporters.

The `html` reporter does not use `outputFile`. It writes a report directory configured by its own `outputDir` option (default `.vitest`). See the [HTML Reporter](/guide/reporters#html-reporter) guide.
