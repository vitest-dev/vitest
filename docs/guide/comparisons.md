---
title: Comparisons with Other Test Runners | Guide
---

# Comparisons with Other Test Runners

## Jest

[Jest](https://jestjs.io/) took over the Testing Framework space by providing out-of-the-box support for most JavaScript projects, a comfortable API (`it` and `expect`), and the full pack of testing features that most setups would require (snapshots, mocks, coverage). We are thankful to the Jest team and community for creating a delightful testing API and pushing forward a lot of the testing patterns that are now a standard in the web ecosystem.

It is possible to use Jest in Vite setups. [@sodatea](https://twitter.com/haoqunjiang) built [vite-jest](https://github.com/sodatea/vite-jest#readme), which aims to provide first-class Vite integration for [Jest](https://jestjs.io/). The last [blockers in Jest](https://github.com/sodatea/vite-jest/blob/main/packages/vite-jest/README.md#vite-jest) have been solved, so this is a valid option for your unit tests.

However, in a world where we have [Vite](https://vitejs.dev) providing support for the most common web tooling (TypeScript, JSX, most popular UI Frameworks), Jest represents a duplication of complexity. If your app is powered by Vite, having two different pipelines to configure and maintain is not justifiable. With Vitest you get to define the configuration for your dev, build and test environments as a single pipeline, sharing the same plugins and the same vite.config.js.

Even if your library is not using Vite (for example, if it is built with esbuild or Rollup), Vitest is an interesting option as it gives you a faster run for your unit tests and a jump in DX thanks to the default watch mode using Vite instant Hot Module Reload (HMR). Vitest offers compatibility with most of the Jest API and ecosystem libraries, so in most projects, it should be a drop-in replacement for Jest.

## Cypress

[Cypress](https://www.cypress.io/) is a browser-based test runner and a complementary tool to Vitest. If you'd like to use Cypress, we suggest using Vitest for all headless logic in your application and Cypress for all browser-based logic.

Cypress is known as an end-to-end testing tool, but their [new component test runner](https://on.cypress.io/component) has great support for testing Vite components and is an ideal choice to test anything that renders in a browser.

Browser-based runners, like Cypress, WebdriverIO and Web Test Runner, will catch issues that Vitest cannot because they use the real browser and real browser APIs.

Cypress's test driver is focused on determining if elements are visible, accessible, and interactive. Cypress is purpose-built for UI development and testing and its DX is centered around test driving your visual components. You see your component rendered alongside the test reporter. Once the test is complete, the component remains interactive and you can debug any failures that occur using your browser devtools.

In contrast, Vitest is focused on delivering the best DX possible for lightning fast, *headless* testing. Node-based runners like Vitest support various partially-implemented browser environments, like `jsdom`, which implement enough for you to quickly unit test any code that references browser APIs. The tradeoff is that these browser environments have limitations in what they can implement. For example, [jsdom is missing a number of features](https://github.com/jsdom/jsdom/issues?q=is%3Aissue+is%3Aopen+sort%3Acomments-desc) like `window.navigation` or a layout engine (`offsetTop`, etc).

Lastly, in contrast to the Web Test Runner, the Cypress test runner is more like an IDE than a test runner because you also see the real rendered component in the browser, along with its test results and logs.

Cypress has also been [integrating Vite in their products](https://www.youtube.com/watch?v=7S5cbY8iYLk): re-building their App's UI using [Vitesse](https://github.com/antfu/vitesse) and using Vite to test drive their project's development.

We believe that Cypress isn't a good option for unit testing headless code, but that using Cypress (for E2E and Component Testing) and Vitest (for unit tests) would cover your app's testing needs.

## WebdriverIO

[WebdriverIO](https://webdriver.io/) is, similar to Cypress, a browser-based alternative test runner and a complementary tool to Vitest. It can be used as an end-to-end testing tool as well as for testing [web components](https://webdriver.io/docs/component-testing). It even uses components of Vitest under the hood, e.g. for [mocking and stubbing](https://webdriver.io/docs/mocksandspies/) within component tests.

WebdriverIO comes with the same advantages as Cypress allowing you to test your logic in real browser. However, it uses actual [web standards](https://w3c.github.io/webdriver/) for automation, which overcomes some of the tradeoffs and limitation when running tests in Cypress. Furthermore, it allows you to run tests on mobile as well, giving you access to test your application in even more environments.

## Web Test Runner

[@web/test-runner](https://modern-web.dev/docs/test-runner/overview/) runs tests inside a headless browser, providing the same execution environment as your web application without the need for mocking out browser APIs or the DOM. This also makes it possible to debug inside a real browser using the devtools, although there is no UI shown for stepping through the test, as there is in Cypress tests.

There is a watch mode, but it is not as intelligent as that of Vitest, and may not always re-run the tests you want.

To use @web/test-runner with a Vite project, use [@remcovaes/web-test-runner-vite-plugin](https://github.com/remcovaes/web-test-runner-vite-plugin). @web/test-runner does not include assertion or mocking libraries, so it is up to you to add them.

## uvu

[uvu](https://github.com/lukeed/uvu) is a test runner for Node.js and the browser. It runs tests in a single thread, so tests are not isolated and can leak across files. Vitest, however, uses worker threads to isolate tests and run them in parallel.

For transforming your code, uvu relies on require and loader hooks. Vitest uses [Vite](https://vitejs.dev), so files are transformed with the full power of Vite's plugin system. In a world where we have Vite providing support for the most common web tooling (TypeScript, JSX, most popular UI Frameworks), uvu represents a duplication of complexity. If your app is powered by Vite, having two different pipelines to configure and maintain is not justifiable. With Vitest you get to define the configuration for your dev, build and test environments as a single pipeline, sharing the same plugins and the same configuration.

uvu does not provide an intelligent watch mode to rerun the changed tests, while Vitest gives you amazing DX thanks to the default watch mode using Vite instant Hot Module Reload (HMR).

uvu is a fast option for running simple tests, but Vitest can be faster and more reliable for more complex tests and projects.
