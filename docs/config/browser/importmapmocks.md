---
title: browser.importMapMocks | Config
outline: deep
---

# browser.importMapMocks <Version type="experimental">5.1.0</Version> <Experimental />

- **Type:** `boolean`
- **Default:** enabled when the browser supports it
- **CLI:** `--browser.importMapMocks`, `--browser.importMapMocks=false`

Serve module mocks through an [import map](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap) in the tester document instead of intercepting network requests.

By default, Vitest checks once per browser whether it accepts an import map after a module has loaded. If it does not, Vitest intercepts requests instead.

An import map rule cannot be removed from the document. When [`isolate`](/config/isolate) is `false`, all test files run in the same document, so Vitest also intercepts requests by default.

Set the option to `true` to always use import maps, or to `false` to always intercept requests.

When a test file calls `vi.mock`, Vitest adds an import map rule that points the module URL to its mocked version: the automocked module, the file in the `__mocks__` folder, or a module that exports every name of the original and reads the values from the factory. The browser loads the mocked module itself, so the provider does not intercept requests (for example, with Playwright's `page.route`) and the mock stays local to the document of the test file.

Request interception adds a cost to every request in the page, which grows with the number of modules a test file imports. An import map has no per-request cost.

::: warning
The browser must support multiple import maps per document: Chromium 133+, Safari 18.4+, and Firefox 150+ with the `dom.multiple_import_maps.enabled` preference. The `playwright` provider sets this preference. Other providers cannot, so Firefox falls back to request interception there.

An import map rule cannot change a module that the document already imported. If a module was imported before `vi.mock` registered it, for example by a setup file that does not mock it, Vitest reports an error instead of silently using the original module.

An import map rule cannot be removed either. When a test file calls `vi.unmock` with a static path, the setup files do not add a rule for that module, so both the setup files and the test file load the original module. `vi.doUnmock` cannot restore the original module.

A factory can only provide the exports that the original module declares. Vitest reads the export names from the original module, so a key that the factory adds cannot be imported, and an export that the factory omits is `undefined`.
:::
