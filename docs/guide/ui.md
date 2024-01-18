---
title: Vitest UI | Guide
---

# Vitest UI

Powered by Vite, Vitest also has a dev server under the hood when running the tests. This allows Vitest to provide a beautiful UI to view and interact with your tests. The Vitest UI is optional, so you'll need to install it with:

```bash
npm i -D @vitest/ui
```

Then you can start the tests with UI by passing the `--ui` flag:

```bash
vitest --ui
```

Then you can visit the Vitest UI at <a href="http://localhost:51204/__vitest__/">`http://localhost:51204/__vitest__/`</a>


<img alt="Vitest UI" img-light src="https://user-images.githubusercontent.com/11247099/171992267-5cae2fa0-b927-400a-8eb1-da776974cb61.png">
<img alt="Vitest UI" img-dark src="https://user-images.githubusercontent.com/11247099/171992272-7c6057e2-80c3-4b17-a7b6-0ac28e5a5e0b.png">

Since Vitest 0.26.0, UI can also be used as a reporter. Use `'html'` reporter in your Vitest configuration to generate HTML output and preview the results of your tests:

```ts
// vitest.config.ts

export default {
  test: {
    reporters: ['html']
  }
}
```

Since Vitest 0.31.0, you can check your coverage report in Vitest UI: check [Vitest UI Coverage](/guide/coverage#vitest-ui) for more details.

::: warning
If you still want to see how your tests are running in real time in the terminal, don't forget to add `default` reporter to `reporters` option: `['default', 'html']`.
:::

::: tip
To preview your HTML report, you can use the [vite preview](https://vitejs.dev/guide/cli.html#vite-preview) command:

```sh
npx vite preview --outDir ./html
```

You can configure output with [`outputFile`](/config/#outputfile) config option. You need to specify `.html` path there. For example, `./html/index.html` is the default value.
:::
