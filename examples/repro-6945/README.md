# Coverage HTML reporter and Vitest UI mode / HTML reporter integration

```sh
# watch ui
pnpm -C examples/repro-6945 test --coverage --ui

# html report
pnpm -C examples/repro-6945 test --coverage --reporter=html --run

# serve
pnpm dlx serve examples/repro-6945/html/

# TODO: browser mode
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
  - how is this currently resolved?
    - ui mode working by default 🙂
    - html report broken 😢
  - at most one coverage iframe view is supported.
    how should we allow configuration?
    - `ui.coverageHtml`?
    - `reporters: [["html", { coverageHtml: "..." }]]`?
    - `coverage.htmlDir`?
    - infer one from another?
    - default to `coverage`?
- browser mode
  - nothing specific

## Ideas

- [ ] copy coverage html output to test html reporter by default
- [ ] add new option to robustly/explicitly support where to copy from
- [ ] consolidate vitest test output into single `.vitest-results`
  - `.vitest-results/attachments` (attachments)
  - `.vitest-results/coverage/index.html` (coverage html directory)
  - `.vitest-results/index.html` (UI assets)
