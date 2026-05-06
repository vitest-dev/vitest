At project root, create terminals with each of the following commands:

```bash
nr ui:dev
```

```bash
nr test --ui --open=false
```

As the last command, you can use any of the available tests suites instead. Make sure that they run at 51204 port or specify a custom port with `VITE_PORT` environmental variable when running the first command. For example,

```bash
VITE_PORT=3200 nr ui:dev
```

```bash
nr test --ui --open=false --api=3200
```

Open the browser at the URL printed by the first command. For example, `http://localhost:5173/`. If you see a connection error, it means the port is specified incorrectly.

<!-- TODO -->

To preview the browser tab, start a browser-mode test server and run the UI dev server with `BROWSER_DEV_PREVIEW=true`.

```bash
# run browser mode test server
pnpm -C packages/ui test:ui --browser.headless --ui

# run ui dev server
BROWSER_DEV_PREVIEW=true pnpm -C packages/ui dev:client
```

To configure the browser state, update the `__vitest_browser_runner__` object in `browser.dev.js` with the real project name, active browser session id, and project root from the browser-mode test server.
