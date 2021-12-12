# Getting Started

## Overview

Vitest is a blazing fast unit test framework powered by Vite.

[**Join the Discord!**](https://discord.com/invite/2zYZNngd7y)

You can learn more about the rationale behind the project in the [Why Vite](./why) section.

:::tip
💖 **This project is currently in closed beta exclusively for Sponsors.**<br>
Become a Sponsor of [@patak-dev](https://github.com/sponsors/patak-dev) or [@antfu](https://github.com/sponsors/antfu) to access the source code and issues tracker.

:::

:::warning
⚠️ **DISCLAIMER**: Vitest is still in development and not stable yet. It's not recommended to use it in production.

Vitest requires Vite v2.7 and Node v16
:::

## Trying Vite Online

You can try Vitest online on [StackBlitz](https://stackblitz.com/edit/node-u5kp1f?file=test%2Fsuite.test.ts). It runs Vitest directly in the browser, and it is almost identical to the local setup but doesn't require installing anything on your machine.

## Adding Vitest to your Project

```bash
$ npm add vitest
```

## Command Line Interface

In a project where Vitest is installed, you can use the `vitest` binary in your npm scripts, or run it directly with `npx vitest`. Here is the default npm scripts in a scaffolded Vite project:

<!-- prettier-ignore -->
```json5
{
  "scripts": {
    "test": "vitest",
    "coverage": "vitest --coverage"
  }
}
```

You can specify additional CLI options like `--port` or `--https`. For a full list of CLI options, run `npx vite --help` in your project.

## Examples

- [Unit Testing](https://github.com/antfu-sponsors/vitest/test/core)
- [Vue Component Testing](https://github.com/antfu-sponsors/vitest/test/vue)
- [React Component Testing](https://github.com/antfu-sponsors/vitest/test/react)
- [Lit Component Testing](https://github.com/antfu-sponsors/vitest/test/lit)
- [Vitesse Component Testing](https://github.com/antfu-sponsors/vitest/test/vitesse)

## Projects using Vitest

- [unocss](https://github.com/antfu/unocss)
- [unplugin-auto-import](https://github.com/antfu/unplugin-auto-import)
- [unplugin-vue-components](https://github.com/antfu/unplugin-vue-components)
- [vitesse-lite](https://github.com/antfu/vitesse-lite)

## Using Unreleased Commits

If you can't wait for a new release to test the latest features, you will need to clone the [vitest repo](https://github.com/antfu-sponsors/vitest) to your local machine and then build and link it yourself ([pnpm](https://pnpm.io/) is required):

```bash
git clone https://github.com/antfu-sponsors/vitest.git
cd vite
pnpm install
cd packages/vite
pnpm run build
pnpm link --global # you can use your preferred package manager for this step
```

Then go to the project where you are using Vitest and run `pnpm link --global vite` (or the package manager that you used to link `vitest` globally).

## Community

If you have questions or need help, reach out to the community at [Discord](https://discord.com/invite/2zYZNngd7y) and [GitHub Discussions](https://github.com/antfu-sponsors/vitest/discussions).
