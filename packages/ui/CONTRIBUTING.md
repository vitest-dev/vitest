# @vitest/ui Development

## UI

Use this setup for developing UI features with Vite HMR. It serves the UI from a separate dev server, so it can differ from the exact `vitest --ui` runtime path.

Start the UI dev server:

```bash
pnpm -C packages/ui dev:client
```

Start a Vitest server that serves the real UI and API token used by the dev server:

```bash
pnpm test --ui --open=false
```

Open the URL printed by the UI dev server, usually `http://localhost:5173/`.

The UI dev server connects to the Vitest server on port `51204` by default. If the Vitest server uses another API port, pass the same port to the UI dev server:

```bash
VITE_PORT=3200 pnpm -C packages/ui dev:client
```

```bash
pnpm test --ui --open=false --api=3200
```

## Browser Mode UI

Use this setup for developing Browser Mode UI features with Vite HMR. It serves the Browser Mode UI from the UI dev server and injects state from a real browser-mode Vitest server.

Start a browser-mode Vitest server:

```bash
pnpm -C packages/ui test:ui --browser.headless --ui --open=false
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
