# Coverage HTML reporter and Vitest UI mode / HTML reporter integration

```sh
# watch ui
pnpm -C examples/repro-6945 test --coverage --ui

# html report
pnpm -C examples/repro-6945 test --coverage --reporter=html --run

# serve
pnpm dlx serve examples/repro-6945/html/
```

## Questions

- html reporter output
  - `reporters: [["html", { outputFile: "html/index.html" }]]`
- coverage reporter option resolution
  - `coverage.reportsDirectory: "./coverage"`
  - `coverage.reporters: [["html", { subdir: '...' }]]`
- artifact/attachments
  - `attachmentsDir: ".vitest-attachments"`
- ui mode / html report iframe url
  - TODO: how is this currently resolved?
  - at most one coverage iframe view is supported.
    how should we allow configuration?
    - `ui.coverageHtml`?
    - `reporters: [["html", { coverageHtml: "..." }]]`?
    - infer one from another?
    - default to `coverage`?
