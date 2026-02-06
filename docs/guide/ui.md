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

::: warning
The UI is interactive and requires a running Vite server, so make sure to run Vitest in `watch` mode (the default). Alternatively, you can generate a static HTML report that looks identical to the Vitest UI by specifying `html` in config's `reporters` option.
:::

<img alt="Vitest UI" img-light src="/ui-1-light.png">
<img alt="Vitest UI" img-dark src="/ui-1-dark.png">

UI can also be used as a reporter. Use `'html'` reporter in your Vitest configuration to generate HTML output and preview the results of your tests:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    reporters: ['html'],
  },
})
```

You can check your coverage report in Vitest UI: see [Vitest UI Coverage](/guide/coverage#vitest-ui) for more details.

::: warning
If you still want to see how your tests are running in real time in the terminal, don't forget to add `default` reporter to `reporters` option: `['default', 'html']`.
:::

::: tip
To preview your HTML report, you can use the [vite preview](https://vitejs.dev/guide/cli.html#vite-preview) command:

```sh
npx vite preview --outDir ./html
```

You can configure output with [`outputFile`](/config/outputfile) config option. You need to specify `.html` path there. For example, `./html/index.html` is the default value.
:::

## Module Graph

Module Graph's tab displays the module graph of the selected test file.

::: info
All of the provided images use [Zammad](https://github.com/zammad/zammad) repository as an example.
:::

<img alt="The module graph view" img-light src="/ui/light-module-graph.png">
<img alt="The module graph view" img-dark src="/ui/dark-module-graph.png">

If there are more than 50 modules, the module graph displays only the first two levels of the graph to reduce the visual clutter. You can always click on "Show Full Graph" icon to preview the full graph.

<center>
  <img alt="The 'Show Full Graph' button located close to the legend" img-light src="/ui/light-ui-show-graph.png">
  <img alt="The 'Show Full Graph' button located close to the legend" img-dark src="/ui/dark-ui-show-graph.png">
</center>

::: warning
Note that if your graph is too big, it may take some time before the node positions are stabilized.
:::

You can always restore the entry module graph by clicking on "Reset". To expand the module graph, right-click or hold <kbd>Shift</kbd> while clicking the node that interests you. It will display all nodes related to the selected one.

By default, Vitest doesn't show the modules from `node_modules`. Usually, these modules are externalized. You can enable them by deselecting "Hide node_modules".

### Module Info

By left-clicking on the module node, you open the Module Info view.

<img alt="The module info view for an inlined module" img-light src="/ui/light-module-info.png">
<img alt="The module info view for an inlined module" img-dark src="/ui/dark-module-info.png">

This view is separated into two parts. The top part shows the full module ID and some diagnostics about the module. If [`experimental.fsModuleCache`](/config/experimental#experimental-fsmodulecache) is enabled, there will be a "cached" or "not cached" badge. On the right you can see time diagnostics:

- Self Time: the time it took to import the module, excluding static imports.
- Total Time: the time it took to import the module, including static imports. Note that this does not include `transform` time of the current module.
- Transform: the time it took to transform the module.

If you opened this view by clicking on an import, you will also see a "Back" button at the start that will take you to the previous module.

The bottom part depends on the module type. If the module is external, you will only see the source code of that file. You will not be able to traverse the module graph any further, and you won't see how long it took to import static imports.

<img alt="The module info view for an external module" img-light src="/ui/light-module-info-external.png">
<img alt="The module info view for an external module" img-dark src="/ui/dark-module-info-external.png">

If the module was inlined, you will see three more windows:

- Source: unchanged source code of the module
- Transformed: the transformed code that Vitest executes using Vite's [module runner](https://vite.dev/guide/api-environment-runtimes#modulerunner)
- Source Map (v3): source map mappings

All static imports in the "Source" window show a total time it took to evaluate them by the current module. If the import was already evaluated in the module graph, it will show `0ms` because it is cached by that point.

If the module took longer than the [`danger` threshold](/config/experimental#experimental-importdurations-thresholds) (default: 500ms) to load, the time will be displayed in red. If the module took longer than the [`warn` threshold](/config/experimental#experimental-importdurations-thresholds) (default: 100ms), the time will be displayed in orange.

You can click on an import source to jump into that module and traverse the graph further (note `./support/assertions/index.ts` below).

<img alt="The module info view for an internal module" img-light src="/ui/light-module-info-traverse.png">
<img alt="The module info view for an internal module" img-dark src="/ui/dark-module-info-traverse.png">

::: warning
Note that type-only imports are not executed at runtime and do not display a total duration. They also cannot be opened.
:::

If another plugin injects a module import during transformation, those imports will be displayed at the start of the module in gray colour (for example, modules injected by `import.meta.glob`). They also show the total time and can be traversed further.

<img alt="The module info view for an internal module" img-light src="/ui/light-module-info-shadow.png">
<img alt="The module info view for an internal module" img-dark src="/ui/dark-module-info-shadow.png">

::: tip
If you are developing a custom integration on top of Vitest, you can use [`vitest.experimental_getSourceModuleDiagnostic`](/api/advanced/vitest#getsourcemodulediagnostic) to retrieve this information.
:::

### Import Breakdown

::: tip FEEDBACK
Please, leave feedback regarding this feature in a [GitHub Discussion](https://github.com/vitest-dev/vitest/discussions/9224).
:::

The Module Graph tab also provides an Import Breakdown with a list of modules that take the longest time to load (top 10 by default), sorted by Total Time.

<img alt="Import breakdown with a list of top 10 modules that take the longest time to load" img-light src="/ui/light-import-breakdown.png">
<img alt="Import breakdown with a list of top 10 modules that take the longest time to load" img-dark src="/ui/dark-import-breakdown.png">

You can click on the module to see the Module Info. If the module is external, it will have the yellow color (the same color in the module graph).

The breakdown shows a list of modules with self time, total time, and a percentage relative to the time it took to load the whole test file.

The "Show Import Breakdown" icon will have a red color if there is at least one file that took longer than the [`danger` threshold](/config/experimental#experimental-importdurations-thresholds) (default: 500ms) to load, and it will be orange if there is at least one file that took longer than the [`warn` threshold](/config/experimental#experimental-importdurations-thresholds) (default: 100ms).

You can use [`experimental.importDurations.limit`](/config/experimental#experimental-importdurationslimit) to control the number of imports displayed.
