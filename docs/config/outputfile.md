---
title: outputFile | Config
outline: deep
---

# outputFile <CRoot /> {#outputfile}

- **Type:** `string | Record<string, string>`
- **CLI:** `--outputFile=<path>`, `--outputFile.json=./path`

Override the output location of the `--reporter=json`, `--reporter=html` or `--reporter=junit` reporters. When not set, these reporters write to a scoped directory under `.vitest/` (`.vitest/json/output.json`, `.vitest/index.html`, `.vitest/junit/output.xml`).
By providing an object instead of a string you can define individual outputs when using multiple reporters.
