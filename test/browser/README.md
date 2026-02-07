# Browser Tests

## Using docker playwright

Some test suites don't support running it remotely (`fixtures/inspect` and `fixtures/insecure-context`).

```sh
# Start playwright browser server
pnpm docker up -d

# Run tests with BROWSER_WS_ENDPOINT
BROWSER_WS_ENDPOINT=ws://127.0.0.1:6677/ pnpm test:playwright
```
