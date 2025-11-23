## TOC

- Key players Node/provide/Orchestrator/Test runner & protocol between them
- A basic flow: init+action+assertion
- How parallelization works
- How isolation works
- How mocking works
- The initiation flow
- Deep dive - the providers, the preview, Cookies, cross-origins, BroadcastChannel
- An 'action' flow
- Paralleziation
- Mocking

## High-Level Overview

Browser Mode transforms Vitest into a browser-native testing framework by executing your tests directly in real browser environments instead of Node.js. This is achieved through a sophisticated architecture that orchestrates Vite's dev server, browser automation tools, and Vitest's test runner.

### Key Components

- **Vitest Orchestrator**: Coordinates test execution and reporting
- **Browser Providers**: Interface layer for browser automation (Playwright, WebdriverIO, or Preview)
- **Vite Dev Server**: Serves test files and handles module transformation
- **Browser Context**: The actual browser environment where tests execute

## How Tests Execute

### The Test Execution Lifecycle

When you run tests in Browser Mode, here's what happens:

1. **Initialization**
   - Vitest starts the Vite dev server
   - Browser provider launches the configured browser
   - Test runner establishes communication between Node.js and browser

2. **Test Discovery**
   - Vite processes test files and dependencies
   - Modules are transformed and served to the browser
   - Test suites are collected and organized

3. **Execution**
   - Tests run in the browser's JavaScript engine
   - DOM APIs, browser globals, and Web APIs are natively available
   - Results stream back to the Node.js process

4. **Reporting**
   - Test results are collected and formatted
   - Coverage data is processed (if enabled)
   - Final report is displayed in your terminal

### Communication Flow

```
Terminal/CLI
    ↓
Vitest Node Process
    ↓
Vite Dev Server ←→ Browser Provider
    ↓                    ↓
Test Files          Real Browser
    ↓                    ↓
    └─── Test Execution ─┘
```

## Browser Mode vs Node Mode

Understanding when to use each mode:

| Aspect | Node Mode | Browser Mode |
|--------|-----------|--------------|
| **Environment** | Node.js runtime | Real browser (Chrome, Firefox, etc.) |
| **APIs Available** | Node.js APIs, DOM simulation | Native browser APIs, real DOM |
| **Performance** | Faster (no browser overhead) | Slower (browser startup cost) |
| **Use Cases** | Unit tests, utilities, Node logic | UI components, browser features, visual testing |
| **Dependencies** | Works out of the box | Requires browser provider |
| **Debugging** | Node debugger | Browser DevTools |

### When to Use Browser Mode

Use Browser Mode when:
- Testing UI components (React, Vue, Svelte, etc.)
- Validating browser-specific behavior
- Testing features that require real DOM (layout, events, rendering)
- Performing visual regression testing
- Testing Web APIs (Canvas, WebGL, Storage, etc.)

Use Node Mode when:
- Testing pure logic or utilities
- Running unit tests for backend code
- Speed is critical and browser features aren't needed
- Testing in CI environments where browsers aren't available

## Under the Hood

### Architecture Deep-Dive

#### Provider System

Vitest's browser providers act as adapters between the test runner and browser automation tools:

```typescript
// Provider interface (simplified)
interface BrowserProvider {
  name: string
  getSupportedBrowsers(): string[]
  initialize(): Promise<void>
  openPage(url: string): Promise<void>
  close(): Promise<void>
}
```

Each provider implements this interface:
- **Playwright**: Uses Microsoft's Playwright library for automation
- **WebdriverIO**: Uses WebDriver protocol for cross-browser support
- **Preview**: Lightweight option that opens a browser without full automation

#### Module Resolution

Browser Mode leverages Vite's module resolution:

1. **Transformation**: TypeScript, JSX, and other formats are compiled
2. **Bundling**: Dependencies are processed but kept separate for HMR
3. **Serving**: Modules are served over HTTP to the browser
4. **Caching**: Vite's caching speeds up subsequent runs

#### Test Isolation

Each test file can run in its own context:

```typescript
// Configuration example
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chromium',
      provider: 'playwright',
      // Isolate tests for reliability
      isolate: true,
    },
  },
})
```

### Integration with Vite

Browser Mode deeply integrates with Vite's dev server:

- **Hot Module Replacement (HMR)**: Tests can reload on file changes (in watch mode)
- **Plugin System**: Vite plugins work seamlessly with test code
- **Optimized Dependencies**: Pre-bundling improves load times
- **Source Maps**: Accurate error stack traces pointing to original source

### Browser Context Management

Vitest manages browser contexts efficiently:

```typescript
// Internal workflow (simplified)
async function runBrowserTests() {
  const browser = await provider.launch()
  const context = await browser.createContext()
  const page = await context.newPage()

  // Navigate to test runner
  await page.goto('http://localhost:5173/__vitest__/')

  // Execute tests and collect results
  const results = await page.evaluate(() => {
    return window.__vitest__.runTests()
  })

  return results
}
```

## Advanced Features

### Headless vs Headed Mode

```typescript
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      // Headed mode for debugging
      headless: false,
    },
  },
})
```

- **Headless**: Faster, suitable for CI/CD pipelines
- **Headed**: Visual feedback, useful for development and debugging

### Multiple Browser Testing

Test across different browsers:

```typescript
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
    },
  },
})
```

### Custom Browser Configuration

Fine-tune browser behavior:

```typescript
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      providerOptions: {
        launch: {
          // Playwright launch options
          devtools: true,
          slowMo: 100,
        },
        context: {
          // Browser context options
          viewport: { width: 1920, height: 1080 },
          locale: 'en-US',
        },
      },
    },
  },
})
```

## Performance Considerations

### Optimization Strategies

1. **Selective Browser Testing**
   - Run fast unit tests in Node mode
   - Reserve Browser Mode for integration/UI tests

2. **Parallel Execution**
   - Vitest runs browser tests in parallel by default
   - Adjust `maxConcurrency` based on your resources

3. **Reuse Browser Instances**
   ```typescript
   export default defineConfig({
     test: {
       browser: {
         // Reuse browser between test files
         isolate: false,
       },
     },
   })
   ```

4. **Optimize Dependencies**
   - Leverage Vite's dependency pre-bundling
   - Use `optimizeDeps` to include commonly used packages

## Debugging

### Using Browser DevTools

With headed mode, you can debug directly in the browser:

```bash
# Run with headed browser
vitest --browser.headless=false
```

Then use:
- `debugger` statements in your code
- Browser DevTools console, network, and performance tabs
- Vitest's trace view for test execution visualization

### Programmatic Debugging

```typescript
import { test } from 'vitest'
import { page } from '@vitest/browser/context'

test('debug example', async () => {
  await page.goto('/my-app')

  // Pause execution for debugging
  await page.pause()

  // Take screenshot for inspection
  await page.screenshot({ path: 'debug.png' })
})
```

## Limitations and Considerations

::: warning Provider-Specific Features
Some features may only be available with specific providers. Always check the documentation for your chosen provider (Playwright, WebdriverIO, or Preview).
:::

### Known Limitations

- **Startup Time**: Browser launch adds overhead compared to Node mode
- **Resource Usage**: Browsers consume more memory and CPU
- **Headless Differences**: Some features behave differently in headless mode
- **Provider Dependencies**: Requires installation of browser binaries

### Environment Differences

Remember that browser environments differ from Node.js:

```typescript
// ❌ Not available in browser
import fs from 'node:fs'
import path from 'node:path'

// ✅ Available in browser
import { userEvent } from '@vitest/browser/context'
```

## Configuration Reference

Common browser mode options:

```typescript
export default defineConfig({
  test: {
    browser: {
      // Enable browser mode
      enabled: true,

      // Browser to use
      name: 'chromium', // or 'firefox', 'webkit', 'edge', 'safari'

      // Provider
      provider: 'playwright', // or 'webdriverio', 'preview'

      // Headless mode
      headless: true,

      // Isolate tests
      isolate: true,

      // API configuration
      api: {
        port: 63315,
        strictPort: false,
      },

      // Provider-specific options
      providerOptions: {
        // Options passed to the provider
      },

      // Viewport size
      viewport: {
        width: 1280,
        height: 720,
      },
    },
  },
})
```

For complete configuration options, see [Browser Mode Config](/config/#browser).

## Related Documentation

- [Why Browser Mode](/guide/browser/why) - Understand the motivation and benefits
- [Getting Started](/guide/browser/) - Set up Browser Mode in your project
- [Component Testing](/guide/browser/component-testing) - Test UI components
- [Visual Regression Testing](/guide/browser/visual-regression-testing) - Visual testing strategies
- [Browser Mode Configuration](/config/#browser) - Complete config reference

## Contributing

If you're interested in contributing to Vitest's Browser Mode:

1. **Source Code**: Browser mode implementation lives in `/packages/browser/`
2. **Provider Code**: Each provider has its own package (e.g., `/packages/browser/providers/playwright/`)
3. **Tests**: Browser mode tests are in `/test/browser/`
4. **Documentation**: You're reading it! Docs are in `/docs/guide/browser/`

Check out the [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md) for more details.

# How Vitest Browser Mode Works Under the Hood

A comprehensive technical deep dive into Vitest Browser Mode's architecture, implementation, and internals.

---

## Table of Contents

1. [Overview & Purpose](#overview--purpose)
2. [Core Architecture](#core-architecture)
3. [How Browser Mode Differs from JSDOM/Happy-DOM](#how-browser-mode-differs-from-jsdomhappy-dom)
4. [Provider Architecture](#provider-architecture)
5. [Communication Layer](#communication-layer)
6. [Module Resolution & Transformation](#module-resolution--transformation)
7. [Mocking Implementation](#mocking-implementation)
8. [Commands API & Node.js Orchestration](#commands-api--nodejs-orchestration)
9. [Interactivity API & User Events](#interactivity-api--user-events)
10. [Test Execution & Isolation](#test-execution--isolation)
11. [Performance Considerations](#performance-considerations)
12. [Limitations & Trade-offs](#limitations--trade-offs)
13. [Visual Regression Testing](#visual-regression-testing)
14. [Watch Mode & HMR Integration](#watch-mode--hmr-integration)
15. [Multi-Browser & Workspace Configuration](#multi-browser--workspace-configuration)
16. [References & Sources](#references--sources)

---

## Overview & Purpose

Vitest Browser Mode is a feature that enables running tests in actual browser environments rather than simulated DOM implementations. Unlike traditional Node.js-based testing with JSDOM or happy-dom, Browser Mode executes tests directly in real browser engines (Chromium, Firefox, WebKit, Safari).

**Key Innovation**: Vitest treats your test suite as a mini application that Vite compiles and serves in the browser, leveraging Vite's dev server infrastructure for transformation and HMR capabilities.

### Why Browser Mode Exists

JSDOM was created in 2010 with the goal of executing browser-oriented code in Node.js without spawning actual browsers, relying on polyfills to bridge API gaps. However, JSDOM's implementation can fall short for advanced use cases:

- Layout calculations and CSS rendering behavior
- Browser APIs not yet supported in JSDOM
- Subtle differences in event handling and timing
- Global API inconsistencies and patching issues

Browser Mode addresses these limitations by testing code written for the browser in the actual browser, eliminating the age of polyfills.

**Source**: [Why Browser Mode | Vitest](https://vitest.dev/guide/browser/why), [InfoQ - Vitest Introduces Browser Mode](https://www.infoq.com/news/2025/06/vitest-browser-mode-jsdom/)

---

## Core Architecture

### Fundamental Design

Vitest Browser Mode leverages **Vite's development server** as its foundation, with several key architectural components:

1. **Vite Dev Server**: Serves the test files and application code
2. **Browser Automation Provider**: Controls the browser (Playwright, WebdriverIO, or preview)
3. **Iframe-based Test Execution**: Each test file runs in a separate iframe
4. **BroadcastChannel Communication**: Enables message passing between iframes
5. **Node.js Orchestration Layer**: Coordinates test execution and reporting

```
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Process                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │          Vitest Test Orchestrator                  │    │
│  │  - Test discovery & scheduling                     │    │
│  │  - Reporter & coverage                             │    │
│  │  - Commands API server                             │    │
│  └──────────────┬─────────────────────────────────────┘    │
│                 │                                            │
│  ┌──────────────▼─────────────────────────────────────┐    │
│  │            Vite Dev Server                         │    │
│  │  - Module transformation                           │    │
│  │  - HMR                                             │    │
│  │  - Code instrumentation                            │    │
│  └──────────────┬─────────────────────────────────────┘    │
└─────────────────┼──────────────────────────────────────────┘
                  │ HTTP (port 63315)
                  │
┌─────────────────▼──────────────────────────────────────────┐
│                    Browser Process                          │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Orchestrator HTML Page                     │    │
│  │  ┌──────────────────┐  ┌──────────────────┐       │    │
│  │  │  Vitest UI       │  │  Test Iframes    │       │    │
│  │  │  (UI controls)   │  │  ┌────────────┐  │       │    │
│  │  └──────────────────┘  │  │test-1.ts   │  │       │    │
│  │                        │  ├────────────┤  │       │    │
│  │  BroadcastChannel ◄────┼──┤test-2.ts   │  │       │    │
│  │  Communication         │  ├────────────┤  │       │    │
│  │                        │  │test-3.ts   │  │       │    │
│  │                        │  └────────────┘  │       │    │
│  │                        └──────────────────┘       │    │
│  └────────────────────────────────────────────────────┘    │
│                                                             │
│  ◄──── Browser Automation (CDP/WebDriver) ────────────────┐│
└─────────────────────────────────────────────────────────────┘
                  │
                  │
        ┌─────────▼──────────┐
        │  Provider          │
        │  (Playwright/      │
        │   WebdriverIO)     │
        └────────────────────┘
```

### Port Assignment

Vitest assigns **port 63315** by default to avoid conflicts with the development server, allowing both to run in parallel.

**Source**: [Browser Mode | Vitest](https://vitest.dev/guide/browser/), [Vitest Browser Mode Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)

---

## How Browser Mode Differs from JSDOM/Happy-DOM

### Architectural Comparison

| Aspect | JSDOM/Happy-DOM | Vitest Browser Mode |
|--------|----------------|---------------------|
| **Execution Environment** | Node.js process with polyfills | Real browser engine |
| **DOM Implementation** | Spec-based simulation | Native browser DOM |
| **CSS Rendering** | Limited/non-existent | Full CSS engine with layout |
| **Event Handling** | Simulated events | Actual browser events via CDP/WebDriver |
| **API Coverage** | Subset of browser APIs | Complete browser API surface |
| **Global State** | Patched Node.js globals | Actual browser globals |
| **Test Location** | Same process as code | Browser iframe |
| **Speed** | Very fast (no browser startup) | Slower (browser initialization) |

### Fundamental Technical Difference

**JSDOM/Happy-DOM**: Polyfill libraries containing WHATWG standards implementations for Node.js. They intentionally remove Node.js global APIs and re-introduce polyfilled counterparts, leading to API gaps and compatibility issues.

**Vitest Browser Mode**: Tests and code run in the same browser window and iframe, with native browser APIs. Both the test and the exercised code execute in identical browser context.

### Key Advantage: Real Browser Testing

Browser Mode provides:

- **Accurate CSS rendering**: Real layout calculations, Flexbox, Grid, etc.
- **Real browser APIs**: Canvas, WebGL, IndexedDB, Service Workers
- **Proper event handling**: Actual event bubbling, capture, and timing
- **Browser-specific behavior**: Catches real-world issues affecting users

**Quote from Vladimir Sheremet (Vitest maintainer)**:
> "Browser Mode changes how you test UI components, giving significantly higher confidence that code will work for real users due to using a real browser. You can replace simulation DOM libraries like JSDOM or happy-dom with an actual browser, without changing the actual test code."

**Sources**:
- [Why Browser Mode | Vitest](https://vitest.dev/guide/browser/why)
- [Epic Web - Why I Won't Use JSDOM](https://www.epicweb.dev/why-i-won-t-use-jsdom)
- [InfoQ Article](https://www.infoq.com/news/2025/06/vitest-browser-mode-jsdom/)
- [Learn With Jason - Vladimir Sheremet Interview](https://codetv.dev/series/learn-with-jason/s7/use-vitest-with-browser-mode)

---

## Provider Architecture

### Provider Concept

Vitest Browser Mode does **not ship its own browser automation**. Instead, it introduces a browser automation provider concept, delegating browser control to specialized tools.

### Supported Providers

#### 1. Playwright Provider (Recommended)

```typescript
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      name: 'chromium', // or 'firefox', 'webkit'
      headless: true,
    },
  },
})
```

**Features**:
- Parallel test execution support
- Chrome DevTools Protocol (CDP) for Chromium
- WebDriver protocol for Firefox/WebKit
- Faster than WebDriver-based solutions
- Supports all three browser engines: Chromium, Firefox, WebKit

**Installation**: `npm install -D @vitest/browser-playwright`

#### 2. WebdriverIO Provider

```typescript
import { defineConfig } from 'vitest/config'
import { webdriverio } from '@vitest/browser-webdriverio'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: webdriverio(),
      name: 'chrome', // or 'firefox', 'edge', 'safari'
    },
  },
})
```

**Features**:
- Supports Chrome, Firefox, Edge, Safari
- Uses WebDriver protocol
- Vitest ignores test runner options, only uses browser capabilities

**Installation**: `npm install -D @vitest/browser-webdriverio`

#### 3. Preview Provider (Development Only)

**Features**:
- No external dependencies
- Uses `@testing-library/user-event` for event simulation
- **No headless mode support**
- Simulates events instead of triggering real ones
- Limited functionality (no drag-and-drop, no real CDP/WebDriver)

**Use Case**: Quick local development when you don't need full browser automation.

**Recommendation**: Switch to Playwright or WebdriverIO for actual testing since preview relies on simulated events instead of using Chrome DevTools Protocol.

### Custom Providers

Vitest supports custom browser automation providers through the provider API. This capability was added based on the WebdriverIO implementation, allowing users to create their own browser automation integrations.

**Sources**:
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Vitest Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)
- [GitHub PR #2999 - WebdriverIO Integration](https://github.com/vitest-dev/vitest/pull/2999)
- [Epic Web - Vitest Browser Mode vs Playwright](https://www.epicweb.dev/vitest-browser-mode-vs-playwright)

---

## Communication Layer

### BroadcastChannel for Inter-Frame Communication

Vitest utilizes the **BroadcastChannel API** to communicate between iframes. This enables coordination between:

- The Vitest UI iframe
- Individual test execution iframes (one per test file)
- The orchestrator page

```javascript
// Conceptual example of how Vitest uses BroadcastChannel
const channel = new BroadcastChannel('vitest-test-channel')

// Test iframe sends result
channel.postMessage({
  type: 'test:result',
  testId: 'test-1',
  status: 'passed'
})

// Orchestrator receives result
channel.addEventListener('message', (event) => {
  if (event.data.type === 'test:result') {
    updateTestStatus(event.data)
  }
})
```

### Iframe Architecture

Vitest 1.6+ implements browser tests using iframes with the following structure:

```html
<div id="vitest-ui">
  <!-- Vitest UI controls -->
</div>
<div id="vitest-tester">
  <iframe src="/test-1.spec.ts"></iframe>
  <iframe src="/test-2.spec.ts"></iframe>
  <iframe src="/test-3.spec.ts"></iframe>
</div>
```

Each test file gets its own iframe for isolation, preventing:
- Global state pollution between tests
- CSS conflicts
- DOM manipulation side effects

### Communication Limitations

**Thread-blocking dialogs** like `alert()` or `confirm()` cannot be used natively because they block the web page, preventing Vitest from continuing communication with the page, causing execution to hang.

**Solution**: Vitest provides default mocks with default returned values for these APIs to prevent execution from hanging.

### Known Issues

- **BroadcastChannel Refresh Bug**: Refreshing the UI manually prevents running tests unless the Vitest process is restarted (Issue #5822)

**Sources**:
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Vitest Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)
- [GitHub Issue #5822](https://github.com/vitest-dev/vitest/issues/5822)
- [Browser Communication via BroadcastChannel](https://blog.immatt.com/2023/01/04/til-browser-window-tab-frame-iframe-intercommunication-via-broadcastchannel-web-api/)

---

## Module Resolution & Transformation

### Browser-Native ESM

Browser Mode uses the **browser's native ES Module support** to serve modules. This creates fundamental differences from Node.js testing:

**Key Constraint**: The module namespace object is **sealed** and cannot be reconfigured, unlike in Node.js tests where Vitest can patch the Module Runner.

```javascript
// In Node.js - Vitest can patch Module Runner
// ✓ Possible to reconfigure module exports

// In Browser Mode - Module namespace is sealed
// ✗ Cannot reconfigure module exports
// Must work within browser ESM constraints
```

### Code Transformation Pipeline

Before browser can consume test files, Vitest must transform source code:

1. **Source File Request**: Browser requests `/test.spec.ts`
2. **Vite Transformation**: Vite transforms TypeScript → JavaScript
3. **Mock Injection**: If module is mocked, inject mock handling code
4. **Instrumentation**: Add coverage instrumentation (if enabled)
5. **Serve Transformed Code**: Browser receives transformed JavaScript

```
Test File Request
       │
       ▼
┌──────────────────┐
│  Vite Transform  │
│  - TypeScript    │
│  - JSX           │
│  - Path aliases  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Mock Injection  │ ◄── If vi.mock() called
│  - Parse exports │
│  - Inject proxy  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Instrumentation │
│  - Coverage      │
└────────┬─────────┘
         │
         ▼
    Browser ESM
```

### How Transformation Enables Mocking

Since it's difficult to replicate ES module resolution in browsers, Vitest transforms source files before the browser consumes them.

**Process**:
1. Vitest intercepts the fetch request via:
   - Playwright's `page.route()` (Playwright provider)
   - Vite plugin API (preview/webdriverio providers)
2. Serves transformed code if the module was mocked
3. Original code if not mocked

**Sources**:
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Mocking Modules | Vitest](https://vitest.dev/guide/mocking/modules)
- GitHub discussions on module resolution challenges

---

## Mocking Implementation

### ESM Mocking Challenges

Traditional mocking in Node.js relies on patching the module system. **This is impossible in browser ESM** because:

- Module namespace objects are sealed (read-only)
- Cannot reassign exports
- Cannot intercept module loading in the same way

### Vitest's Solution: Code Transformation + Proxy Pattern

#### 1. Auto-Mocking

When you call `vi.mock('./module.js')`, Vitest:

1. **Parses static exports** from the module
2. **Creates a placeholder module** with mocked functions
3. **Injects `__private_module__` variable** to hold mocked values

```typescript
// Original module
export const getValue = () => 'real value'
export const calculate = x => x * 2

// Transformed for browser (conceptual)
const __private_module__ = {
  getValue: vi.fn(() => undefined),
  calculate: vi.fn(() => undefined)
}

export const getValue = (...args) => __private_module__.getValue(...args)
export const calculate = (...args) => __private_module__.calculate(...args)
```

#### 2. Spy Mode

Use `vi.mock('./module.js', { spy: true })` to spy on exports without replacing them:

```typescript
import { vi } from 'vitest'

// Automatically spy on every export without replacing
vi.mock('./module.js', { spy: true })

import { getValue } from './module.js'

// getValue still works normally, but is wrapped in a spy
expect(getValue).toHaveBeenCalled()
```

**Implementation**: If the user called `vi.mock` with `spy: true`, Vitest passes down the original value; otherwise, creates a simple `vi.fn()` mock.

#### 3. Factory Functions

Provide custom implementations:

```typescript
vi.mock('./api.js', () => ({
  fetchData: vi.fn(() => Promise.resolve({ data: 'mocked' })),
  postData: vi.fn()
}))
```

### Limitations

**Cannot mock variable exports directly**. You must use exported accessor methods:

```typescript
// ✗ Won't work in Browser Mode
export let count = 0
vi.mock('./counter.js', () => ({ count: 5 }))

// ✓ Use accessor methods instead
export const getCount = () => count
export function setCount(val) { count = val }
```

### Module Reset Limitations

`vi.resetModules()` **cannot be implemented** in Browser Mode due to ESM limitations. This API will throw an error when running in the browser.

**Sources**:
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Mocking | Vitest](https://vitest.dev/guide/mocking)
- [GitHub Issue #3046 - Module Mocking Implementation](https://github.com/vitest-dev/vitest/issues/3046)

---

## Commands API & Node.js Orchestration

### Architecture Overview

Vitest presents an ergonomic solution for using Node.js utilities in browser tests: keep your Node.js test setup in Node.js, and expose it granularly via the **Commands API**.

This works because **Vitest spawns a Node.js server to orchestrate your test run**, even when running browser tests.

### Context Object

Browser tests can access the context object via `@vitest/browser/context`:

```typescript
import { cdp, page, server } from '@vitest/browser/context'

// Access to server-side commands
const fileContent = await server.commands.readFile('./data.txt')

// Access to browser automation
await page.click('#submit-button')
```

**Available properties**:
- `server.commands` - Built-in and custom commands
- `page` - Full page containing the test iframe (orchestrator HTML)
- `iframe` - FrameLocator for querying elements on the page
- `context` - Unique BrowserContext reference
- `cdp()` - Chrome DevTools Protocol access (Playwright + Chromium only)

### Built-in Commands

#### File Operations

```typescript
import { server } from '@vitest/browser/context'

// Read file (relative to project root since Vitest 3.2)
const content = await server.commands.readFile('./data.json')

// Write file
await server.commands.writeFile('./output.txt', 'test data')

// Remove file
await server.commands.removeFile('./temp.txt')
```

**Important**: Since Vitest 3.2, all paths are resolved **relative to the project root** (`process.cwd()`), not relative to test files.

**Security**: File access respects Vite's `server.fs` security boundaries.

#### CDP Access

```typescript
import { cdp } from '@vitest/browser/context'

// Only works with Playwright provider + Chromium
const client = await cdp()
await client.send('Network.enable')
```

### Custom Commands

Define custom commands to bridge browser and Node.js:

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import type { BrowserCommand } from 'vitest/node'

const customCommand: BrowserCommand<[message: string]> = (
  { testPath, provider },
  message
) => {
  // This runs in Node.js
  console.log(`Test ${testPath}: ${message}`)
  return { received: message }
}

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      commands: {
        customCommand,
      },
    },
  },
})
```

```typescript
// test.spec.ts
import { server } from '@vitest/browser/context'

test('uses custom command', async () => {
  const result = await server.commands.customCommand('hello')
  expect(result.received).toBe('hello')
})
```

### Provider-Specific Context

#### Playwright Context

```typescript
import { context, iframe, page } from '@vitest/browser/context'

// page: Full orchestrator page
// iframe: FrameLocator for test iframe
// context: BrowserContext

const frame = await page.frame()
await frame.click('#button')
```

#### WebdriverIO Context

```typescript
import { browser } from '@vitest/browser/context'

// browser: WebdriverIO.Browser API
// Vitest automatically switches context to test iframe before commands
```

### Command Override

Custom commands with identical names override built-in ones, allowing you to customize behavior.

**Sources**:
- [Commands | Browser Mode | Vitest](https://vitest.dev/api/browser/commands)
- [Context API | Vitest](https://vitest.dev/guide/browser/context)
- [Vitest Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)

---

## Interactivity API & User Events

### The Problem with @testing-library/user-event

`@testing-library/user-event` **simulates** events by creating and dispatching synthetic events. This doesn't accurately represent how users interact with browsers.

### Vitest's Solution: Real Browser Interactions

Vitest provides its own `userEvent` implementation that uses **Chrome DevTools Protocol (CDP)** or **WebDriver** to trigger actual browser events.

```typescript
import { userEvent } from '@vitest/browser/context'

// These trigger REAL browser events via CDP/WebDriver
await userEvent.click(element)
await userEvent.type(element, 'Hello World')
```

### Implementation by Provider

| Provider | Protocol | Implementation Details |
|----------|----------|------------------------|
| **Playwright** | Chrome DevTools Protocol (Chromium)<br>WebDriver (Firefox/WebKit) | Uses `locator.click()`, supports `modifiers` parameter directly, `tripleClick()` uses `clickCount: 3` |
| **WebdriverIO** | WebDriver | Uses `ElementClick` or actions API, `tripleClick()` via `move + down/up/pause` sequences, file upload limited to Chrome/Edge |
| **Preview** | Simulation | Falls back to `@testing-library/user-event` (simulated events, **not recommended**) |

### Key Architectural Difference: Stateful UserEvent

Vitest's default `userEvent` instance **persists keyboard state** across method calls:

```typescript
// This works in Vitest Browser Mode
await userEvent.keyboard('{Shift}')
await userEvent.keyboard('a') // Types 'A' (shift is still pressed)
await userEvent.keyboard('{/Shift}')

// This wouldn't work with @testing-library/user-event
// because it creates fresh instances per call
```

### Supported Methods

- `setup()` - Create new userEvent instance
- `click()`, `dblClick()`, `tripleClick()`
- `fill()` - Fill input/textarea
- `keyboard()` - Keyboard input with modifiers
- `tab()` - Navigate with Tab
- `type()` - Type text (combines keyboard + fill)
- `clear()` - Clear input value
- `selectOptions()` - Select dropdown options
- `hover()`, `unhover()` - Mouse hover
- `upload()` - File upload
- `dragAndDrop()` - Drag & drop (not supported in preview provider)
- `copy()`, `cut()`, `paste()` - Clipboard operations

### Example: Real vs Simulated Events

```typescript
// Simulated (testing-library)
import { userEvent } from '@testing-library/user-event'
await userEvent.click(button)
// ^ Dispatches synthetic 'click' event

// Real (Vitest Browser Mode with Playwright)
import { userEvent } from '@vitest/browser/context'
await userEvent.click(button)
// ^ Uses CDP: client.send('Input.dispatchMouseEvent', {...})
// Actual browser processes the click through its event pipeline
```

**Sources**:
- [Interactivity API | Vitest](https://vitest.dev/guide/browser/interactivity-api)
- [Vitest Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)
- [GitHub Issue #5770 - Interactivity API](https://github.com/vitest-dev/vitest/issues/5770)

---

## Test Execution & Isolation

### File-Level Isolation

By default, Vitest runs **every test file in an isolated environment**:

```bash
# Default: isolated execution
vitest --browser

# Disable isolation for performance
vitest --browser --browser.isolate=false
```

**Isolation = true** (default):
- Each test file runs in a fresh browser context
- No state pollution between files
- Increases reliability
- Slower performance

**Isolation = false**:
- Test files share browser context
- Faster execution
- Risk of state pollution
- Useful when tests don't rely on side effects

### Test-Level Isolation

Unlike traditional Vitest (which isolates by test function), Browser Mode isolates **by file**, similar to Web Test Runner or Cypress.

**Why?**
- Browser context creation is expensive
- Iframe creation/destruction overhead
- Balance between isolation and performance

### Parallel Execution

```bash
# Default: parallel execution
vitest --browser --browser.fileParallelism=true

# Disable parallelism
vitest --browser --browser.fileParallelism=false
```

**Playwright supports parallel execution**, making tests run faster. WebdriverIO also supports parallelism.

**Key Point**: Vitest runs test **files** in parallel, not individual test cases.

### Test Sharding

For CI environments, split tests across multiple machines:

```bash
# Run 1/4 of test files
vitest --browser --shard=1/4 --reporter=blob

# Run 2/4 of test files on another machine
vitest --browser --shard=2/4 --reporter=blob
```

Vitest splits **test files** (not individual test cases) into shards. If you have 1000 files, `--shard=1/4` runs 250 files.

### Multi-Instance Architecture

When using multiple browser instances (e.g., different browsers or configurations), Vitest transforms these into **separate test projects sharing a single Vite server** for better caching performance.

```typescript
// Single Vite server, multiple browser instances
export default defineConfig({
  test: {
    browser: {
      instances: [
        { browser: 'chromium', name: 'chromium-1' },
        { browser: 'firefox', name: 'firefox-1' },
        { browser: 'webkit', name: 'webkit-1' },
      ],
    },
  },
})
```

**Performance Benefit**: File transformation and dependency pre-bundling happens only once, shared across all browser instances.

**Sources**:
- [Improving Performance | Vitest](https://vitest.dev/guide/improving-performance)
- [Parallelism | Vitest](https://vitest.dev/guide/parallelism)
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Vitest Sharding Documentation](https://runebook.dev/en/articles/vitest/guide/cli/shard)

---

## Performance Considerations

### Initialization Overhead

**Main Performance Drawback**: Vitest Browser Mode requires spinning up the provider and browser during initialization, which takes time.

```
Node.js Tests:        ~100ms startup
Browser Mode Tests:   ~2-5s startup (browser launch + page load)
```

### Performance Profile

| Aspect | Speed | Notes |
|--------|-------|-------|
| **Cold Start** | Slow | Browser launch + Vite server + page load |
| **Watch Mode** | Fast | Leverages Vite's HMR for instant feedback |
| **Parallel Execution** | Fast | Playwright provider supports parallelism |
| **Sequential Execution** | Slow | Single browser instance bottleneck |
| **Test Isolation** | Slow | Creating fresh browser contexts is expensive |

### Optimization Strategies

1. **Use Headless Mode for CI**:
   ```typescript
   browser: { headless: process.env.CI === 'true' }
   ```

2. **Disable Isolation When Safe**:
   ```typescript
   browser: { isolate: false }
   ```

3. **Enable Parallel Execution** (default with Playwright):
   ```typescript
   browser: { fileParallelism: true }
   ```

4. **Use Shared Vite Server** with multiple instances:
   ```typescript
   browser: {
     instances: []
     // Single Vite server = better caching
   }
   ```

5. **Test Sharding for CI**:
   ```bash
   vitest --browser --shard=1/4
   ```

### Preparation Time Metrics

When running tests in the browser, preparation time includes:
- Vite server initialization
- Browser launch
- **Iframe initialization** for each test file
- Module transformation and bundling

### Watch Mode Performance

Vitest Browser Mode leverages **Vite's instant HMR** in watch mode:

- Change file → Vite transforms → Browser reloads tests instantly
- No full page refresh needed (Vitest 2.0+)
- Smart module graph searching (only reruns related tests)

**Quote from documentation**:
> "Vitest provides Smart & instant watch mode, like HMR for tests"

### Benchmark Capabilities

Browser Mode enables **benchmarking TypeScript code in browser environments**, useful for:
- Canvas performance
- WebGL operations
- Browser API benchmarks

**Sources**:
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Improving Performance | Vitest](https://vitest.dev/guide/improving-performance)
- [Why Vitest | Vitest](https://vitest.dev/guide/why)
- [GitHub - canvas-benchmark](https://github.com/jacomyal/canvas-benchmark)

---

## Limitations & Trade-offs

### 1. Early Development Stage

Browser Mode is still **experimental** and may not be fully optimized. There can be bugs or issues not yet ironed out.

**Status**: Vitest 4.0 delivered **stable Browser Mode** (as announced at ViteConf 24).

### 2. ESM-Related Constraints

Some APIs cannot be implemented due to ESM limitations:

- **`vi.resetModules()`** - Throws error in browser mode
- **Direct variable mocking** - Must use accessor methods
- **Module namespace reconfiguration** - Not possible (sealed objects)

### 3. Test Isolation Differences

Tests are isolated **by file**, not by test function:
- Different from traditional Vitest behavior
- Similar to Web Test Runner or Cypress
- Cannot have per-test isolation without performance hit

### 4. Thread-Blocking APIs

Dialogs like `alert()` or `confirm()` cannot be used natively:

**Problem**: They block the web page → Vitest cannot continue communicating → execution hangs

**Solution**: Vitest provides default mocks with default return values

```typescript
// These are automatically mocked
alert('message') // No-op
confirm('question') // Returns true by default
prompt('question') // Returns empty string by default
```

### 5. URL Testing Limitations

**Major limitation vs Playwright Component Testing**:

Vitest Browser Mode lacks the **browser's address bar**, limiting URL query param testing:

```typescript
// Cannot test in Vitest Browser Mode
const searchParams = new URLSearchParams(window.location.search)
expect(searchParams.get('tab')).toBe('settings')
```

**Workaround**: Use Playwright for E2E tests requiring URL navigation.

### 6. Headed Browser Limitations

**Cannot run multiple headed browsers simultaneously**:

```typescript
// This will fail if headless: false
instances: [
  { browser: 'chromium' },
  { browser: 'firefox' }, // Error!
]
```

**Solution**: Use `headless: true` or select a single project for development.

### 7. Visual Regression Limitations

`toMatchScreenshot()` is only available in **Vitest 4.x beta** and requires stable environments:

**Problem**: Screenshots differ across machines due to font rendering

**Solution**: Use Docker containers or cloud services (Azure App Testing)

### 8. Coverage Collection

Coverage instrumentation in Browser Mode has limitations:
- Requires specific configuration
- May not work with all providers
- Performance impact on transformation pipeline

### 9. Recommended Augmentation

**Official recommendation**: Augment Vitest browser experience with a standalone browser-side test runner:
- WebdriverIO (for cross-browser E2E)
- Cypress (for complex E2E workflows)
- Playwright (for advanced browser automation)

### 10. Known Bugs

- **Bundling/transpilation issues** (Issue #6023)
- **maxWorkers not respected** - runs on all CPUs (Issue #7446)
- **Blank page issues** in browser window (Issue #5308)
- **Flakiness** in browser mode (Issue #5706)
- **BroadcastChannel refresh bug** (Issue #5822)
- **Headless mode type conversion** - CLI doesn't convert boolean (Issue #5055)

**Sources**:
- [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
- [Why Browser Mode | Vitest](https://vitest.dev/guide/browser/why)
- GitHub issues: #6023, #7446, #5308, #5706, #5822, #5055
- [Epic Web - Vitest vs Playwright](https://www.epicweb.dev/vitest-browser-mode-vs-playwright)

---

## Visual Regression Testing

### Built-in Support (Vitest 4.x Beta)

Vitest 4.x introduces **native visual regression testing** with `toMatchScreenshot()`:

```typescript
import { expect, test } from 'vitest'
import { page } from '@vitest/browser/context'

test('button looks correct', async () => {
  const button = page.getByRole('button')
  await expect(button).toMatchScreenshot('primary-button')
})
```

### How It Works

1. **First run**: Captures reference screenshot
2. **Subsequent runs**: Captures new screenshot, compares with reference
3. **Diff detection**: Uses **pixelmatch** (planned) for pixel comparison
4. **Failure**: If differences exceed threshold, test fails

### Environment Stability Requirement

**Critical**: Visual regression tests are **inherently unstable** across different environments.

**Problem**: Font rendering, GPU differences, OS-specific rendering

**Solution**: Use the **same environment everywhere**:
- Docker containers
- Cloud services (Azure App Testing)
- CI with consistent images

### Provider Support

Currently available in **Vitest 4.x beta** with:
- Playwright provider
- WebdriverIO provider

**Not available in preview provider** (no real browser automation).

### Comparison with Playwright

Playwright's `toHaveScreenshot()` provides:
- Pixel-to-pixel visual comparison
- Advanced diffing algorithms
- Retry mechanisms for flaky screenshots

**Limitation**: Playwright's `toHaveScreenshot()` **only works with native Playwright tests**, not Vitest Browser Mode.

### Current Workarounds

For visual regression in Vitest Browser Mode (pre-4.x):

1. **Manual screenshot capture**:
   ```typescript
   import { page } from '@vitest/browser/context'
   await page.screenshot({ path: 'snapshot.png' })
   ```

2. **External comparison tools**:
   - Use pixelmatch manually
   - Integrate with Percy, Chromatic, or Applitools

3. **Playwright for visual testing**:
   Use Playwright separately for visual regression, Vitest for component logic

**Sources**:
- [Visual Regression Testing | Vitest](https://vitest.dev/guide/browser/visual-regression-testing.html)
- [Alexop.dev - Visual Regression with Vitest](https://alexop.dev/posts/visual-regression-testing-with-vue-and-vitest-browser/)
- [Maya Shavin - Vitest vs Playwright Visual Testing](https://mayashavin.com/articles/visual-testing-vitest-playwright)
- [GitHub Issue #6265](https://github.com/vitest-dev/vitest/issues/6265)
- [Markus Oberlehner - Visual Regression with Vitest](https://markus.oberlehner.net/blog/visual-regression-testing-with-vitest)

---

## Watch Mode & HMR Integration

### Vitest's Watch Mode

Vitest starts in **watch mode by default** in development, running mode in CI:

```bash
vitest           # watch mode (default in dev)
vitest watch     # explicit watch mode
vitest run       # run once and exit
```

### Leveraging Vite's HMR

Vitest leverages **Vite's instant Hot Module Reload** for browser tests:

1. **File change detected** → Vite transforms module
2. **Module graph analysis** → Determine affected tests
3. **Smart rerun** → Only rerun related tests
4. **HMR update** → Browser updates without full page refresh (Vitest 2.0+)

```
File Change (component.ts)
       ↓
Module Graph Analysis
       ↓
Affected Tests: [component.test.ts]
       ↓
Vite Transform
       ↓
HMR to Browser
       ↓
Test Rerun (no page refresh!)
```

### No Page Refresh (Vitest 2.0+)

**Key improvement in Vitest 2.0**: You can change files directly inside the UI and tests will be reloaded **without a page refresh**.

**Before Vitest 2.0**: File changes triggered full page reload
**Vitest 2.0+**: HMR updates test modules in-place

### Performance Benefits

Traditional testing:
```
Change code → Jest restarts → 5-10s → Results
```

Vitest with HMR:
```
Change code → Vite HMR → <1s → Results
```

**Quote from benchmarks**:
> "Vitest shines in watch mode with 5x to 10x faster feedback than Jest"

### Watch Mode in Browser Mode

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: 'playwright',
      headless: false, // See tests update in real-time
    },
  },
})
```

```bash
vitest --browser --ui
# Changes to tests or source → instant HMR update in browser UI
```

### HMR Lifecycle APIs

Modules can handle HMR updates:

```typescript
if (import.meta.hot) {
  import.meta.hot.accept((newModule) => {
    // Handle module replacement
  })
}
```

Vitest uses this mechanism to reload test modules without full page refresh.

**Sources**:
- [Why Vitest | Vitest](https://vitest.dev/guide/why)
- [Features | Vitest](https://vitest.dev/guide/features)
- [HMR API | Vite](https://vite.dev/guide/api-hmr)
- [Comparisons | Vitest](https://vitest.dev/guide/comparisons)
- [Vitest Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)

---

## Multi-Browser & Workspace Configuration

### Browser Instances

Since **Vitest 3**, you can specify multiple browser setups using `browser.instances`:

```typescript
import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [
        {
          browser: 'chromium',
          name: 'chromium-desktop',
          setupFiles: ['./chromium.setup.ts'],
        },
        {
          browser: 'firefox',
          name: 'firefox-desktop',
        },
        {
          browser: 'webkit',
          name: 'webkit-desktop',
        },
      ],
    },
  },
})
```

**Important**: Define a custom `name` if using the same browser multiple times:

```typescript
instances: [
  {
    browser: 'chromium',
    name: 'chromium-1', // Custom name required
    provide: { ratio: 1 },
  },
  {
    browser: 'chromium',
    name: 'chromium-2', // Custom name required
    provide: { ratio: 2 },
  },
]
```

### Advantages Over Workspace

**Main advantage**: Improved caching.

Every project in `instances` uses the **same Vite server**, meaning:
- File transformation happens **only once**
- Dependency pre-bundling **shared**
- Better performance than separate workspace projects

### Workspace/Projects Configuration

**Note**: `workspace` is deprecated since Vitest 3.2, replaced with `projects`. They are functionally the same.

```typescript
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: ['**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            provider: 'playwright',
            instances: [
              { browser: 'chromium' },
              { browser: 'firefox' },
            ],
          },
        },
      },
    ],
  },
})
```

### Context Switching

Vitest automatically switches the WebDriver/CDP context to the test iframe:

**Playwright**:
```typescript
// Vitest handles context switching internally
// iframe is a FrameLocator for the test iframe
const element = iframe.locator('#button')
```

**WebdriverIO**:
```typescript
// Vitest automatically calls browser.switchToFrame before commands
const button = await browser.$('#button')
```

### CDP Session (Playwright + Chromium Only)

```typescript
import { cdp } from '@vitest/browser/context'

// Only works with Playwright provider + Chromium browser
const client = await cdp()
await client.send('Network.enable')
```

### Headed Mode Limitation

**Cannot run multiple headed browsers simultaneously**:

```
Error: Vitest cannot run multiple headed browsers at the same time.
Select a single project to run or use "headless: true" option.
```

**Solution for development**: Select one browser, run others headless.

**Sources**:
- [Multiple Setups | Vitest](https://vitest.dev/guide/browser/multiple-setups)
- [Test Projects | Vitest](https://vitest.dev/guide/projects)
- [Context API | Vitest](https://vitest.dev/guide/browser/context)
- [Epic Web - React Component Testing](https://react-component-testing-with-vitest.epicweb.dev/exercise/02/05/solution)
- GitHub Issue #7661, #7521

---

## Key Differences: Vitest Browser Mode vs Playwright Component Testing

| Aspect | Vitest Browser Mode | Playwright Component Testing |
|--------|---------------------|------------------------------|
| **Test Execution** | Tests run **in the browser** | Tests run **in Node.js**, control browser remotely |
| **Rendering** | Uses framework's native render (e.g., React's `render()`) | Cannot tap into `render()` from `react-dom` directly |
| **Communication** | Direct (same context) | Message channel between Node.js and browser |
| **Framework Agnostic** | Yes, fully framework-agnostic | Requires specific component wrappers |
| **Test Runner** | Vitest (unified) | Playwright (separate tool) |
| **URL Testing** | Limited (no address bar) | Full URL support with address bar |
| **Visual Regression** | `toMatchScreenshot()` (beta) | `toHaveScreenshot()` (stable, pixel-perfect) |
| **Setup** | Single tool, integrated with Vitest | Separate setup and run |
| **Primary Use Case** | Component-level testing | E2E and component testing |

**Quote from comparison**:
> "Vitest Browser Mode runs your `component.test.tsx` **in the browser**, while Playwright component tests run in a **Node.js process** and control the browser remotely... Because the place where you render your component (the Node.js test) and where it is supposed to render (the browser page) live in two separate universes."

**Sources**:
- [Epic Web - Vitest Browser Mode vs Playwright](https://www.epicweb.dev/vitest-browser-mode-vs-playwright)
- [GitHub Issue #34819 - Playwright vs Vitest](https://github.com/microsoft/playwright/issues/34819)
- [Component Testing with Playwright and Vitest](https://www.thecandidstartup.org/2025/01/06/component-test-playwright-vitest.html)

---

## References & Sources

### Official Documentation
1. [Browser Mode | Vitest](https://vitest.dev/guide/browser/)
2. [Why Browser Mode | Vitest](https://vitest.dev/guide/browser/why)
3. [Commands API | Vitest](https://vitest.dev/api/browser/commands)
4. [Interactivity API | Vitest](https://vitest.dev/guide/browser/interactivity-api)
5. [Context API | Vitest](https://vitest.dev/guide/browser/context)
6. [Multiple Setups | Vitest](https://vitest.dev/guide/browser/multiple-setups)
7. [Visual Regression Testing | Vitest](https://vitest.dev/guide/browser/visual-regression-testing.html)
8. [Mocking | Vitest](https://vitest.dev/guide/mocking)
9. [Improving Performance | Vitest](https://vitest.dev/guide/improving-performance)
10. [Why Vitest | Vitest](https://vitest.dev/guide/why)

### GitHub Discussions & Issues
11. [Vitest Browser Mode Discussion #5828](https://github.com/vitest-dev/vitest/discussions/5828)
12. [Implement module mocking - Issue #3046](https://github.com/vitest-dev/vitest/issues/3046)
13. [Interactivity API - Issue #5770](https://github.com/vitest-dev/vitest/issues/5770)
14. [Browser mode broken - Issue #6023](https://github.com/vitest-dev/vitest/issues/6023)
15. [maxWorkers not respected - Issue #7446](https://github.com/vitest-dev/vitest/issues/7446)
16. [Blank page issues - Issue #5308](https://github.com/vitest-dev/vitest/issues/5308)
17. [Browser mode flaky - Issue #5706](https://github.com/vitest-dev/vitest/issues/5706)
18. [BroadcastChannel refresh bug - Issue #5822](https://github.com/vitest-dev/vitest/issues/5822)
19. [Headless boolean conversion - Issue #5055](https://github.com/vitest-dev/vitest/issues/5055)
20. [Visual regression support - Issue #6265](https://github.com/vitest-dev/vitest/issues/6265)
21. [Playwright vs Vitest differences - Issue #34819](https://github.com/microsoft/playwright/issues/34819)
22. [WebdriverIO integration - PR #2999](https://github.com/vitest-dev/vitest/pull/2999)

### Articles & Blog Posts
23. [Reliable Component Testing with Vitest's Browser Mode and Playwright - Maya Shavin](https://mayashavin.com/articles/component-testing-browser-vitest)
24. [Effective Visual Regression Testing: Vitest vs Playwright - Maya Shavin](https://mayashavin.com/articles/visual-testing-vitest-playwright)
25. [Visual Regression Testing With Vitest - Markus Oberlehner](https://markus.oberlehner.net/blog/visual-regression-testing-with-vitest)
26. [React Component Testing with Vitest's Browser Mode - Akos Komuves](https://akoskm.com/react-component-testing-with-vitests-browser-mode-and-playwright/)
27. [From JSDOM to Real Browsers: Testing Svelte - Scott Spence](https://scottspence.com/posts/testing-with-vitest-browser-svelte-guide)
28. [Testing Quasar Apps with Vitest Browser Mode - Milan Keser](https://medium.com/@smrtnyk/testing-quasar-vue-components-with-vitest-browser-mode-a-complete-guide-1c52691b32e1)
29. [Visual Regression Testing with Vue and Vitest - Alexop.dev](https://alexop.dev/posts/visual-regression-testing-with-vue-and-vitest-browser/)
30. [Component Testing with Playwright and Vitest - The Candid Startup](https://www.thecandidstartup.org/2025/01/06/component-test-playwright-vitest.html)
31. [Angular tests with Vitest browser mode - Ninja Squad](https://blog.ninja-squad.com/2025/11/18/angular-tests-with-vitest-browser-mode/)

### Epic Web Resources
32. [Vitest Browser Mode vs Playwright - Epic Web](https://www.epicweb.dev/vitest-browser-mode-vs-playwright)
33. [Why I Won't Use JSDOM - Epic Web](https://www.epicweb.dev/why-i-won-t-use-jsdom)
34. [React Component Testing with Vitest - Epic Web Workshop](https://react-component-testing-with-vitest.epicweb.dev/)

### News & Announcements
35. [Vitest Introduces Browser Mode as Alternative to JSDOM - InfoQ](https://www.infoq.com/news/2025/06/vitest-browser-mode-jsdom/)
36. [Vitest 3.2 is out! - Vitest Blog](https://vitest.dev/blog/vitest-3-2.html)

### Videos & Presentations
37. [Use Vitest with Browser Mode - Learn With Jason (Vladimir Sheremet)](https://codetv.dev/series/learn-with-jason/s7/use-vitest-with-browser-mode)
38. [The State of Vitest - ViteConf 24 (Vladimir Sheremet)](https://viteconf.org/24/replay/state_of_vitest)
39. [The road to Vitest 1.0 - PodRocket Podcast (Vladimir Sheremet)](https://podrocket.logrocket.com/the-road-to-vitest-vladimir-sheremet)
40. [Vitest Browser Mode - Speaker Deck (Vue Fes Japan 2024)](https://speakerdeck.com/odanado/vitest-browser-mode)

### Integration Guides
41. [Vitest Browser Mode - MSW Integration](https://mswjs.io/docs/recipes/vitest-browser-mode/)
42. [Browser Mode - Marmicode Cookbook](https://cookbook.marmicode.io/angular/testing/vitest-browser-mode)

### Technical References
43. [BroadcastChannel Web API - Blog.immatt](https://blog.immatt.com/2023/01/04/til-browser-window-tab-frame-iframe-intercommunication-via-broadcastchannel-web-api/)
44. [HMR API - Vite](https://vite.dev/guide/api-hmr)
45. [Vitest Sharding Documentation](https://runebook.dev/en/articles/vitest/guide/cli/shard)

---

## Summary

Vitest Browser Mode represents a paradigm shift in frontend testing, bridging the gap between the speed of Node.js-based testing and the accuracy of real browser testing. By leveraging Vite's development server, iframe-based test execution, BroadcastChannel communication, and provider-based browser automation (Playwright/WebdriverIO), it enables developers to run component tests in actual browsers while maintaining the familiar Vitest API and workflow.

**Key Architectural Insights**:

1. **Vite-Powered**: Uses Vite's dev server for transformation, HMR, and module serving
2. **Iframe Isolation**: Each test file runs in a separate iframe for isolation
3. **BroadcastChannel**: Enables communication between test iframes and orchestrator
4. **Provider-Based**: Delegates browser automation to Playwright/WebdriverIO
5. **Native ESM**: Leverages browser's native ESM, requiring code transformation for mocking
6. **Node.js Orchestration**: Spawns Node.js server for test coordination and Commands API
7. **Real Events**: Uses CDP/WebDriver for actual browser interactions, not simulated events
8. **Shared Caching**: Multiple browser instances share a single Vite server for performance

**Best Use Cases**:
- Component testing requiring real DOM/CSS
- Browser API testing (Canvas, WebGL, etc.)
- Layout and interaction testing
- Visual regression testing (Vitest 4.x+)
- Tests requiring accurate browser behavior

**When to Use Alternatives**:
- Pure logic/utility testing → Node.js Vitest
- Full E2E with URL navigation → Playwright E2E
- Complex user flows → Cypress
- Pixel-perfect visual regression → Playwright's toHaveScreenshot()

Vitest Browser Mode continues to evolve, with Vitest 4.0 delivering stable Browser Mode and ongoing improvements in performance, stability, and feature completeness.

---

**Document Compiled**: November 2024
**Research Sources**: 45+ official docs, articles, GitHub issues, videos, and technical references
**Vitest Version Context**: 3.x - 4.x (Browser Mode stabilized in 4.0)
