---
title: Why Vitest | Guide
---

# Why Vitest

:::tip NOTE
Vitest is powered by Vite. While you do not need to know Vite to use Vitest, understanding Vite helps explain some of Vitest's unique advantages. To learn more about Vite, read the [Why Vite Guide](https://vitejs.dev/guide/why.html) or watch [Next generation frontend tooling with ViteJS](https://www.youtube.com/watch?v=UJypSr8IhKY) by [Evan You](https://bsky.app/profile/evanyou.me).
:::

## The Need for a Vite Native Test Runner

Vite's out-of-the-box support for common web patterns, features like glob imports and SSR primitives, and its many plugins and integrations are fostering a vibrant ecosystem. Its dev and build story are key to its success. For docs, there are several SSG-based alternatives powered by Vite. Vite's Unit Testing story hasn't been clear though. Existing options like [Jest](https://jestjs.io/) were created in a different context. There is a lot of duplication between Jest and Vite, forcing users to configure two different pipelines.

Using Vite dev server to transform your files during testing, enables the creation of a simple runner that doesn't need to deal with the complexity of transforming source files and can solely focus on providing the best DX during testing. A test runner that uses the same configuration of your App (through `vite.config.js`), sharing a common transformation pipeline during dev, build, and test time. That is extensible with the same plugin API that lets you and the maintainers of your tools provide first-class integration with Vite. A tool that is built with Vite in mind from the start, taking advantage of its improvements in DX, like its instant Hot Module Reload (HMR). This is Vitest, a next generation testing framework powered by Vite.

Given Jest's massive adoption, Vitest provides a compatible API that allows you to use it as a drop-in replacement in most projects. It also includes the most common features required when setting up your unit tests (mocking, snapshots, coverage). Vitest cares a lot about performance and uses Worker threads to run as much as possible in parallel. Some ports have seen test running an order of magnitude faster. Watch mode is enabled by default, aligning itself with the way Vite pushes for a dev first experience. Even with all these improvements in DX, Vitest stays lightweight by carefully choosing its dependencies (or directly inlining needed pieces).

**Vitest aims to position itself as the Test Runner of choice for Vite projects, and as a solid alternative even for projects not using Vite.**

Continue reading in the [Getting Started Guide](./index)

## How is Vitest Different from X?

You can check out the [Comparisons](./comparisons) section for more details on how Vitest differs from other similar tools.
