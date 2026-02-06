# browser test

## Using docker playwright

```sh
# Start playwright server
pnpm compose up -d

# Run tests with BROWSER_WS_ENDPOINT
BROWSER_WS_ENDPOINT=ws://127.0.0.1:6677/ pnpm test:playwright
```
