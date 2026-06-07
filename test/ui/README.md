# test/ui

```sh
# run e2e on playwright
pnpm test
pnpm test --ui

# run fixture projects
pnpm test-fixtures --root fixtures/main --ui
pnpm test-fixtures --root fixtures/trace

# generate html report and use it for UI dev
pnpm -C test/ui test-fixtures --root fixtures/trace --reporter=html --ui=false --run
HTML_REPORT_DIR="$PWD/test/ui/fixtures/trace/html" pnpm -C packages/ui dev:client
```
