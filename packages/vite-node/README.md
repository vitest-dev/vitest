# vite-node

[![NPM version](https://img.shields.io/npm/v/vite-node?color=a1b858&label=)](https://www.npmjs.com/package/vite-node)

Vite as Node runtime. The engine powers [Vitest](https://github.com/vitest-dev/vitest).

## Features

- Out-of-box ESM & TypeScript support (possible for more with plugins)
- Top-level await
- Vite plugins, resolve, aliasing
- Respect `vite.config.ts`
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

## Programmatic Usage

In Vite Node, the server and runner (client) are separated, so you can integrate them in different contexts (workers, cross-process, or remote) if needed. The demo below shows a simple example of having the server and running in the same context

```ts
import { createServer } from 'vite'
import { ViteNodeServer } from 'vite-node/server'
import { ViteNodeRunner } from 'vite-node/client'

// create vite server
const server = await createServer()
// this is need to initialize the plugins
await server.pluginContainer.buildStart({})

// create vite-node server
const node = new ViteNodeServer(server)

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
})

// execute the file
await runner.executeFile('./example.ts')

// close the vite server
await server.close()
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
