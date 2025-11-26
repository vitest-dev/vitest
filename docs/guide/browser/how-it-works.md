---
title: How Browser Mode Works | Browser Mode
outline: deep
---

# How Browser Mode Works

## Why This Guide Is Important

This article explains the architecture, internals, and workflow of Vitest's Browser Mode. Whether you're a user wanting to understand how your tests execute or a contributor exploring the codebase, this guide covers both high-level concepts and technical implementation details.

## The Philosophy

Vitest Browser Mode can be used for any kind of webpage testing, though its unique characteristics truly shine in page-level or component testing. Here, you can achieve both realism with a real browser and exceptional developer experience with performance.

Developers who write unit or component tests with great libraries like React Testing Library want to keep past features like test coverage and mocking while gaining the benefits of browser realism and the same level of performance, more or less. This supports a true shift-left workflow: developers can execute tests early while coding and sometimes even use Browser Mode as their development browser to watch the UI evolve as code is written.

This guide helps you find the sweet spot between visual and realistic tests and performant, developer-friendly testing. Understanding the mechanisms and configuration options explained here will help you tune your setup to meet your testing goals.

## The Key Players {#key-players}

- **The Node.js process** - This is where the CLI is invoked. It performs common setup tasks like filtering test files and orchestrates a pool of test workers where actual execution happens.

- **The provider** - Responsible for instantiating and interacting with a real browser using specific technologies like Playwright, WebDriver I/O, or custom implementations. This is configurable. For simplicity, the rest of this guide assumes Playwright usage, but most concepts apply to every provider.

- **The tester page** - An HTML page rendered inside the browser created by the provider. It hosts the code under test along with Vitest utilities needed to execute tests.

- **Iframe & the test runner** - An iframe is placed inside the tester page where tests execute and components render. This provides isolation (explained in the Parallelization and Isolation section). Inside the iframe, the test runner kicks off—whether vanilla Vitest or Browser Mode specific. It processes test files and functions, executing code to generate success/failure reports. During test execution, components are also rendered inside this iframe. **A crucial point**: your tests themselves execute inside the real browser, not just the code being tested. This enables not only visual page testing but also unit tests that run in an actual browser environment with full access to browser APIs like Canvas, WebGL, IndexedDB, and the real DOM. Unlike Node.js-based testing with JSDOM or happy-dom, your tests have access to the complete browser API surface and real browser behavior.

- **The orchestrator** - The Node.js process is the main coordinator with full permissions, while the tester page has limited browser access. The orchestrator bridges these environments, managing messages and actions between the test runner and the Node.js process. **The limitation**: Running tests in the browser means limited access to Node.js APIs (filesystem, process, OS-level operations). To bridge this gap, Vitest provides the **Commands API**—a mechanism that lets your browser-based tests call back to the Node.js orchestrator to perform server-side operations like reading files or executing Node.js utilities. See the next section for a basic flow that demonstrates why this is needed.

## Browser Providers {#providers}

Vitest doesn't ship its own browser automation. Instead, it uses a **provider system** that delegates browser control to specialized tools:

- **Playwright** (recommended): Uses Chrome DevTools Protocol (CDP) for Chromium and WebDriver for Firefox/WebKit. Supports parallel execution and all three major browser engines.
- **WebdriverIO**: Uses the WebDriver protocol for cross-browser support including Chrome, Firefox, Edge, and Safari.
- **Preview**: Lightweight development-only option with no headless mode. Uses simulated events instead of real browser automation—useful for quick local development but not recommended for actual testing.

## A Basic Flow {#basic-flow}

### Initializing a Test Flow {#initializing-test-flow}

The attached diagram shows how the main thread's worker pool opens the browser using one of the providers (in this example, Playwright). Here's what happens:

1. The worker pool requests the provider to render the tester page, which contains the test orchestrator and a test runner inside an iframe
2. The main thread asks the orchestrator to start running a specific test suite
3. The orchestrator instructs the test runner to execute the file
4. The test runner processes each test and executes it
5. If a test renders a component, it appears inside an anchor element placed in the page
6. Finally, the test reports success or failure back to the main thread via the orchestrator

![Browser Mode Initialization Flow](/vitest-browser-initializing-test-suite.png)

### Typical Action Flow {#typical-action-flow}

The diagram illustrates the following flow:

1. When a test needs to perform a user interaction (like a click), the test runner wants to trigger a realistic event using the browser's low-level driver
2. However, it lacks permission to access the browser's low-level API directly, so it sends a message via **WebSocket** to the orchestrator in the Node.js main thread
3. The main thread receives the message and sends a command to the provider (in this example, Playwright)
4. The provider sends a **CDP message** (Chrome DevTools Protocol)—or a WebDriver message if using WebDriver I/O—to the browser
5. This triggers a realistic event—an event that enters through the browser's low-level API and is close to how users interact with their mouse and keyboard (not a JS-space click on a DOM)—that closely mimics how a user click happens in a production environment

![Browser Mode Action Flow](/vitest-browser-typical-action.png)

### Communication Channels {#communication-channels}

Three different communication mechanisms work together to enable browser testing:

- **BroadcastChannel**: The orchestrator and test runner (running in an iframe) communicate within the browser using the BroadcastChannel API—a browser feature that allows different contexts (iframes, windows, tabs) to send messages on a named channel. This enables coordination between the test UI and test execution without involving the Node.js process.

- **WebSocket**: The browser communicates with the Node.js main thread via WebSocket for operations requiring Node.js permissions (like file access via Commands API) or for reporting test results back to the orchestrator.

- **CDP/WebDriver**: The provider (Playwright/WebdriverIO) sends low-level browser automation commands using Chrome DevTools Protocol (for Chromium) or WebDriver protocol (for other browsers). These protocols enable real browser events and interactions.

### Module Resolution and Transformation {#module-transformation}

Before your tests can run, modules need to be transformed and served to the browser:

1. **Test file request**: The browser requests a test file (e.g., `/test.spec.ts`)
2. **Vite transformation**: Vite's dev server transforms TypeScript to JavaScript, resolves path aliases, and processes JSX
3. **Mock injection**: If `vi.mock()` was called for a module, Vitest injects mock handling code by intercepting the HTTP request via the provider's network interception (Playwright's `page.route()`)
4. **Instrumentation**: Coverage instrumentation is added if enabled
5. **Serve to browser**: The transformed JavaScript module is served to the browser's native ES module loader

This transformation pipeline is what enables features like mocking in the browser—by intercepting and modifying module requests before they reach the browser.

## Mocking Code and Network Calls {#mocking}

### Mocking Code {#mocking-code}

Vitest, unlike many end-to-end solutions, is designed primarily for component and page testing. In this environment, while mocking is generally minimized, it's sometimes necessary.

Here's a typical mocking flow when a test uses `vi.mock()` or other test double instructions:

1. **Hoisting** - Vitest hoists the mocking instruction to the beginning of the file
2. **Registration** - When the page loads, it first parses the test file and notes the request to mock a specific module (this happens first because the mocking statement was placed at the beginning)
3. **Interception** - When the code under test (e.g., a frontend page) tries to import the original module, Vitest recognizes it was registered in the mocking registry
4. **Substitution** - Vitest serves the mocked module (the one defined in the test) instead of the original

**How interception works**: Playwright's network interceptor `page.route()` is used to intercept HTTP requests for modules. When the browser requests a mocked module, the provider intercepts the request and serves the mock implementation instead of the original code.

### Network Mocking {#network-mocking}

It's common to mock or intercept network requests. Some testing strategies even encourage this practice.

Since Browser Mode executes code inside an actual browser, any capability available in a browser environment remains available for your tests. Techniques or libraries that worked in your unit or component tests with JSDOM can be reused in Browser Mode.

You can use popular libraries for mocking network requests like [MSW (Mock Service Worker)](https://mswjs.io) and similar tools. These libraries work seamlessly in Browser Mode just as they would in your actual application.

## Parallelization and Isolation {#parallelization-isolation}

When dealing with real browsers and tests with significant footprints, there's always a trade-off between performance and safety. Isolating each test with a unique browser can have an unbearable performance impact. On the other hand, running multiple tests simultaneously over the same view risks introducing collisions. Finding the right balance for your specific case is key.

### File-Level Configuration {#file-level}

Before test files execute, a new browser context is created (similar to opening a new incognito window). This means test files executed in a single worker process start from a clean browser state.

By default, each file (a test suite) gets a fresh iframe to run in, isolating it from previously run test suites. If you want to change this for better performance, set `isolate: false` in your configuration. This provides a performance boost but might cause test suites to interfere with each other.

```typescript
export default defineConfig({
  test: {
    isolate: false, // Share iframe between test files
  },
})
```

By default, test files execute sequentially, one after another, not concurrently. While this reduces performance, it provides better isolation so each test file can assume no other tests are running simultaneously in the same browser.

You can enable parallel execution by setting `fileParallelism: true`. When enabled, multiple iframes are created in the same browser, allowing tests to run simultaneously.

```typescript
export default defineConfig({
  test: {
    fileParallelism: true, // Run test files in parallel
  },
})
```

::: warning Interactive APIs and Parallelism
From the [official Vitest documentation](https://v1.vitest.dev/config/#browser-fileparallelism):

"This makes it impossible to use interactive APIs (like clicking or hovering) because there are several iframes on the screen at the same time, but if your tests don't rely on those APIs, it might be much faster to just run all of them at the same time."
:::

### Test-Level Isolation {#test-level}

By design, tests inside a test file are not isolated from each other. After one test completes, the next executes in the same iframe, potentially sharing the same globals, CSS namespace, and event listeners.

It's the application's responsibility to decide whether this is an issue. If it is, clean up at the application level and/or use test runner cleanup mechanisms like mock resets in `beforeEach` or `afterEach` hooks.
