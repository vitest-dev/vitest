<p align="center">
<img src="https://github.com/vitest-dev/vitest/blob/main/packages/vite-node/assets/vite-node.svg?raw=true" height="120">
</p>

<h1 align="center">
vite-node
</h1>
<p align="center">
Vite as Node runtime.<br>The engine powers <a href="https://github.com/vitest-dev/vitest">Vitest</a> and <a href="https://github.com/nuxt/framework">Nuxt 3 Dev SSR</a>.
<p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitest"><img src="https://img.shields.io/npm/v/vite-node?color=FCC72B&label="></a>
<p>

## Features

- On-demand evaluation
- Vite's pipeline, plugins, resolve, aliasing
- Out-of-box ESM & TypeScript support
- Respect `vite.config.ts`
- Hot module replacement (HMR)
- Separate server/client architecture
- Top-level `await`
- Shims for `__dirname` and `__filename` in ESM
- Access to native node modules like `fs`, `path`, etc.

## CLI Usage

Run JS/TS file on Node.js using Vite's resolvers and transformers.

```bash
npx vite-node index.ts
```

Options:

```bash
npx vite-node -h
```

### Options via CLI

[All `ViteNodeServer` options](https://github.com/vitest-dev/vitest/blob/main/packages/vite-node/src/types.ts#L70-L89) are supported by the CLI. They may be defined through the dot syntax, as shown below:

```bash
npx vite-node --options.deps.inline="module-name" --options.deps.external="/module-regexp/" index.ts
```

Note that for options supporting RegExps, strings passed to the CLI must start _and_ end with a `/`;

## Programmatic Usage

In Vite Node, the server and runner (client) are separated, so you can integrate them in different contexts (workers, cross-process, or remote) if needed. The demo below shows a simple example of having both (server and runner) running in the same context

```ts
import { createServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'
import { installSourcemapsSupport } from 'vite-node/source-map'

// create vite server
const server = await createServer({
  optimizeDeps: {
    // It's recommended to disable deps optimization
    disabled: true,
  },
})
// this is need to initialize the plugins
await server.pluginContainer.buildStart({})

// create vite-node server
const node = new ViteNodeServer(server)

// fixes stacktraces in Errors
installSourcemapsSupport({
  getSourceMap: source => node.getSourceMap(source),
})

// create vite-node runner
const runner = new ViteNodeRunner({
  root: server.config.root,
  base: server.config.base,
  // when having the server and runner in a different context,
  // you will need to handle the communication between them
  // and pass to this function
  fetchModule(id) {
    return node.fetchModule(id)
  },
  resolveId(id, importer) {
    return node.resolveId(id, importer)
  },
})

// execute the file
await runner.executeFile('./example.ts')

// close the vite server
await server.close()
```

## Debugging

### Debug Transformation

Sometimes you might want to inspect the transformed code to investigate issues. You can set environment variable `VITE_NODE_DEBUG_DUMP=true` to let vite-node write the transformed result of each module under `.vite-node/dump`.

If you want to debug by modifying the dumped code, you can change the value of `VITE_NODE_DEBUG_DUMP` to `load` and search for the dumpped files and use them for executing.

```bash
VITE_NODE_DEBUG_DUMP=load vite-node example.ts
```

Or programmatically:

```js
import { ViteNodeServer } from 'vite-node/server'

const server = new ViteNodeServer(viteServer, {
  debug: {
    dumpModules: true,
    loadDumppedModules: true,
  }
})
```

### Debug Execution

If the process get stuck, it might because there is a unresolvable circular dependencies, you can set `VITE_NODE_DEBUG_RUNNER=true` to vite-node warn about it.

```bash
VITE_NODE_DEBUG_RUNNER=true vite-node example.ts
```

Or programmatically:

```js
import { ViteNodeRunner } from 'vite-node/client'

const runner = new ViteNodeRunner({
  debug: true
})
```

## Credits

Based on [@pi0](https://github.com/pi0)'s brilliant idea of having a Vite server as the on-demand transforming service for [Nuxt's Vite SSR](https://github.com/nuxt/vite/pull/201).

Thanks [@brillout](https://github.com/brillout) for kindly sharing this package name.

## Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

## License

[MIT](./LICENSE) License © 2021 [Anthony Fu](https://github.com/antfu)
