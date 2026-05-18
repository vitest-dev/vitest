# @vitest/ui Development

## UI

Use this setup for developing UI features with Vite HMR. It serves the UI from a separate dev server, so it can differ from the exact `vitest --ui` runtime path.

Start the UI dev server:

```bash
# Align with the API port configured in test/unit/vite.config.ts.
VITE_PORT=3023 pnpm -C packages/ui dev:client
```

Start a Vitest UI/API server for any test project you want to use as the backend. For example, from the repository root this runs the `test/unit` suite with UI enabled:

```bash
pnpm test --ui --open=false
```

The UI dev server only needs a real Vitest UI/API server to connect to; the backend can be `test/unit`, `packages/ui`, or another suite.

Open the URL printed by the UI dev server, usually `http://localhost:5173/`.

The UI dev server connects to the Vitest UI/API server on port `51204` by default. The root `test/unit` suite uses port `3023`, so the command above sets `VITE_PORT=3023`. If you use another backend port, pass the same port to the UI dev server:

```bash
VITE_PORT=12345 pnpm -C packages/ui dev:client
```

```bash
pnpm test --ui --open=false --api=12345
```

## Browser Mode UI

Use this setup for developing Browser Mode UI features with Vite HMR. It serves the Browser Mode UI from the UI dev server and injects state from a real browser-mode Vitest server.

Start a browser-mode Vitest server:

```bash
pnpm -C packages/ui test:ui --ui --open=false
```

Start the UI dev server in browser preview mode:

```bash
BROWSER_DEV=true pnpm -C packages/ui dev:client
```

Open the URL printed by the UI dev server, usually `http://localhost:5173/`.

The UI dev server fetches browser runner state from the browser runner server on port `63315` by default. If Vitest prints a different browser runner port, pass it to the UI dev server:

```bash
BROWSER_DEV_PORT=63316 BROWSER_DEV=true pnpm -C packages/ui dev:client
```

## HTML report

Use this setup for developing static HTML report UI with Vite HMR.

```bash
HTML_REPORT_DIR=<path-to-html-report-dir> pnpm -C packages/ui dev:client
```

For example,

```bash
pnpm -C packages/ui test:ui --reporter=html --run
HTML_REPORT_DIR="$PWD/packages/ui/html" pnpm -C packages/ui dev:client
```
