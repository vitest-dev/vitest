---
title: browser.importMapMocks | Config
outline: deep
---

# browser.importMapMocks <Version type="experimental">5.1.0</Version> <Experimental />

- **Type:** `boolean`
- **Default:** `false`
- **CLI:** `--browser.importMapMocks`, `--browser.importMapMocks=false`

Serve module mocks through an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) in the tester document instead of intercepting network requests.

When a test file calls `vi.mock`, Vitest adds an import map rule that points the module URL to its mocked version: the automocked module, the file in the `__mocks__` folder, or a module that exports every name of the original and reads the values from the factory. The browser loads the mocked module itself, so the provider does not intercept requests (for example, with Playwright's `page.route`) and the mock stays local to the document of the test file.

Request interception adds a cost to every request in the page, which grows with the number of modules a test file imports. An import map has no per-request cost.

::: warning
The browser must support multiple import maps per document: Chromium 133+, Safari 18.4+, and Firefox 150+ with the `dom.multiple_import_maps.enabled` preference. The `playwright` provider enables this preference automatically. Other providers cannot, so Firefox reports an error when this option is enabled.

An import map rule cannot change a module that the document already imported. If a module was imported before `vi.mock` registered it, for example by a setup file that does not mock it, Vitest reports an error instead of silently using the original module.

A factory can only provide the exports that the original module declares. Vitest reads the export names from the original module, so a key that the factory adds cannot be imported, and an export that the factory omits is `undefined`.
:::
