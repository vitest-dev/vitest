# Issue #9043: OpenTelemetry Browser Mode Support

**Issue URL:** https://github.com/vitest-dev/vitest/issues/9043
**Status:** Open
**Priority:** p2-nice-to-have
**Labels:** feat: browser, feat: open telemetry

## Problem Statement

OpenTelemetry tracing is currently not supported in browser mode. While tracing works correctly in the main thread (Node.js environment), the browser test runner explicitly disables traces.

From the issue description:
> Test runner inside the browser mode doesn't support traces at the moment, but traces in the main thread are working correctly.

## Architecture Mapping: Node.js Pool vs Browser Pool

This section documents the high-level architectural mapping between the existing Node.js pool implementation (which has full OpenTelemetry support) and the browser pool implementation (which currently has none).

### Node.js Pool Architecture (packages/vitest/src/node/pools/poolRunner.ts)

**Key Components:**

1. **PoolRunner class** - Manages a single worker thread/process
   - One instance per worker
   - Handles worker lifecycle (start, stop)
   - Creates and manages OpenTelemetry spans
   - Propagates trace context to workers

2. **Traces Integration:**
   - `_traces` - Reference to main Vitest traces instance (line 81)
   - `_otel` - Per-runner OTEL state tracking (lines 61, 82-94):
     - `span` - Overall worker span (`vitest.worker`)
     - `workerContext` - OpenTelemetry context for this worker
     - `currentContext` - Active span context (changes during operations)
     - `files` - List of files processed by this worker

3. **OpenTelemetry Spans Created:**
   - `vitest.worker` - Overall worker lifespan (line 83)
     - Created when PoolRunner is instantiated
     - Ended when worker is stopped (line 320)
     - Attributes: worker name, project, environment (lines 89-93)
     - Tracks all files processed (line 246)

   - `vitest.worker.start` - Worker startup span (line 189)
     - Wraps worker initialization
     - Records exceptions on failure (line 226)

   - `vitest.worker.stop` - Worker shutdown span (line 263)
     - Wraps graceful shutdown
     - Records teardown errors (line 269)

   - `vitest.{worker.name}.start` - Actual worker process start (line 177-180)
     - Uses traces context: `this._otel?.workerContext`

   - `vitest.{worker.name}.stop` - Actual worker process stop (line 304-308)
     - Uses traces context: `this._otel?.workerContext`

4. **Context Propagation (OTELCarrier):**
   - `getOTELCarrier()` - Extracts trace context for worker messages (lines 149-154)
   - Sent in every worker request:
     - `start` message - Initial worker setup (line 216)
     - `run`/`collect` message - Test execution (line 145)
     - `stop` message - Shutdown (line 290)
   - Workers receive and restore context using `traces.getContextFromCarrier()`

5. **Worker Communication:**
   - Messages defined in `types.ts` as `WorkerRequest` / `WorkerResponse`
   - Each request includes `otelCarrier?: OTELCarrier` field
   - Workers receive `traces` config in start message (lines 213-217):
     ```ts
     traces: {
       enabled: boolean
       sdkPath?: string
       otelCarrier?: OTELCarrier
     }
     ```

### Browser Pool Architecture (packages/vitest/src/node/pools/browser.ts)

**Key Components:**

1. **BrowserPool class** - Manages multiple browser sessions/tabs
   - One pool per project
   - Coordinates multiple concurrent browser sessions
   - **No OpenTelemetry integration currently**

2. **Session/Orchestrator Model:**
   - `openPage(sessionId)` - Opens browser page with unique session ID (lines 250-264)
   - Each session gets an orchestrator (retrieved via `getOrchestrator()`, line 266-272)
   - Orchestrator is the browser-side coordinator (lives in browser context)
   - Multiple sessions can run in parallel (based on `maxWorkers`)

3. **Key Operations (no spans currently):**
   - `runTests()` - Main entry point for test execution (lines 201-248)
     - Creates sessions (loops to create N workers, lines 234-244)
     - Manages test queue
     - Orchestrates parallel execution

   - `openPage()` - Browser page initialization (lines 250-264)
     - Creates session promise
     - Opens browser page via provider
     - Waits for both to complete

   - `runNextTest()` - Runs a single test file in a session (lines 292-355)
     - Pops file from queue
     - Calls `orchestrator.createTesters()`
     - Recursively processes queue
     - Handles errors and cancellation

   - `finishSession()` - Marks session as complete (lines 274-290)
     - Tracks ready sessions
     - Resolves promise when all sessions done

4. **Orchestrator Communication:**
   - Orchestrators retrieved from `project.browser.state.orchestrators`
   - Methods called:
     - `createTesters()` - Start test execution (line 323)
     - `cleanupTesters()` - Clean up after tests (line 308)
     - `$close()` - Close orchestrator (line 158)
   - **No trace context passed currently**

5. **No Traces Integration:**
   - No `_traces` reference
   - No `_otel` state tracking
   - No spans created
   - No context propagation to browser

### Architectural Mapping: Node.js → Browser

| Node.js Pool Component | Browser Pool Equivalent | Status | Notes |
|------------------------|-------------------------|--------|-------|
| **PoolRunner instance** | **BrowserPool per-session state?** | ❌ Missing | Need to track per-session or per-pool spans |
| `_traces` reference | Need in BrowserPool | ❌ Missing | Should reference `vitest._traces` |
| `_otel` state | Need session/pool-level OTEL state | ❌ Missing | Track spans and contexts |
| **Spans:** | | | |
| `vitest.worker` span | `vitest.browser.session` or `vitest.browser.pool` | ❌ Missing | Track session/pool lifecycle |
| `vitest.worker.start` | `vitest.browser.session.start` | ❌ Missing | Wrap `openPage()` |
| `vitest.worker.stop` | `vitest.browser.session.stop` | ❌ Missing | Wrap session cleanup |
| Worker process spans | Provider operation spans | ❌ Missing | Wrap provider.openPage(), etc. |
| **Context Propagation:** | | | |
| `getOTELCarrier()` | Need in BrowserPool | ❌ Missing | Extract context for browser |
| `otelCarrier` in WorkerRequest | Pass to orchestrator? | ❌ Missing | How to send to browser? |
| Worker receives in start message | Orchestrator receives how? | ❌ Missing | window object? RPC? |

### Key Differences to Consider

1. **Worker Model:**
   - **Node.js:** One PoolRunner = One worker process/thread
   - **Browser:** One BrowserPool = Multiple sessions (N browser tabs/contexts)
   - **Implication:** Need to decide span hierarchy - pool-level or session-level?

2. **Communication:**
   - **Node.js:** Direct process messages with serialized data
   - **Browser:** RPC calls to orchestrator + browser iframe execution
   - **Implication:** How to pass OTELCarrier to browser context?

3. **Initialization:**
   - **Node.js:** Worker imports Node SDK, initializes in worker process
   - **Browser:** Need to load Web SDK in browser, initialize in page context
   - **Implication:** Different SDK path, different initialization code

4. **Lifecycle:**
   - **Node.js:** Worker starts → runs tests → stops (clear lifecycle)
   - **Browser:** Pool manages queue → sessions run tests → sessions finish (more complex)
   - **Implication:** When to create/end spans? Per-session or per-pool?

### Proposed Span Hierarchy for Browser Mode

Based on Node.js architecture, here's a proposed hierarchy:

```
vitest.browser.pool (per BrowserPool instance)
├─ vitest.browser.session.start (per openPage call)
│  └─ vitest.browser.provider.openPage (provider operation)
├─ vitest.browser.session.run (per runNextTest call)
│  ├─ vitest.browser.session.setBreakpoint (if debugging)
│  └─ vitest.browser.orchestrator.createTesters (orchestrator RPC)
│     └─ [Browser context - need Web SDK]
│        └─ vitest.runtime.* (test execution in browser)
└─ vitest.browser.session.cleanup (session cleanup)
```

**Key Questions:**
1. Should `vitest.browser.pool` span cover entire pool lifecycle, or should we have individual session spans?
2. Should session spans be children of pool span, or siblings?
3. How do we propagate context from pool → orchestrator → browser page?

## Current State

### Node.js Mode (Fully Working)
- Traces are initialized in the main thread via the `Traces` class
- Configuration via `experimental.openTelemetry.enabled` and `sdkPath`
- Uses Node.js OpenTelemetry SDK (`@opentelemetry/sdk-node`)
- Context propagation via W3C Trace Context (OTELCarrier) across worker processes
- Spans created for worker lifecycle, runtime setup, and test execution

### Browser Mode (Not Working)
- **Explicitly disabled** in `packages/browser/src/client/tester/runner.ts:300-302`:
  ```ts
  // TODO
  // disable tracing in the browser for now
  trace = undefined
  __setTraces = undefined
  ```
- TODO comments in `packages/browser/src/client/tester/tester.ts:124-125`
- Documentation warns: "Vitest does not start any spans when running in the browser"

## Key Challenges

### 1. Different OpenTelemetry SDK Required
- **Node.js:** Uses `@opentelemetry/sdk-node` (for Node.js environment)
- **Browser:** Needs `@opentelemetry/sdk-trace-web` (for browser environment)
- Cannot use Node.js SDK in browser JavaScript VM

### 2. Architecture Differences
| Aspect | Node.js | Browser |
|--------|---------|---------|
| Runtime | Node.js process | Browser JavaScript VM |
| Workers | Node worker threads/processes | Browser iframes/web workers |
| SDK Package | `@opentelemetry/sdk-node` | `@opentelemetry/sdk-trace-web` |
| Context Propagation | Process messages with OTELCarrier | MessagePort or HTTP headers |
| Initialization | Main thread + workers | Browser page + orchestrator |

### 3. Configuration Complexity
- Should browser mode use the same `sdkPath` as Node.js mode?
- Do we need a separate `browserSdkPath` configuration?
- Can we detect and use appropriate SDK automatically?
- Should browser mode require a separate project configuration?

## Implementation Options

### Option 1: Separate Browser SDK Path (Minimal Change)
**Approach:** Add a new `browserSdkPath` configuration option

**Config:**
```ts
experimental: {
  openTelemetry: {
    enabled: true,
    sdkPath: './otel-node.js',      // For Node.js workers
    browserSdkPath: './otel-browser.js'  // NEW: For browser mode
  }
}
```

**Pros:**
- Clean separation of concerns
- User has full control over each SDK
- Minimal changes to existing architecture
- No ambiguity about which SDK to use

**Cons:**
- Requires two separate SDK files
- More configuration overhead
- Duplication of similar code

### Option 2: Per-Project Configuration (Documentation Focus)
**Approach:** Use existing project-level config to separate browser and Node.js tracing

**Config:**
```ts
export default defineConfig({
  test: {
    projects: [
      {
        name: 'node',
        experimental: {
          openTelemetry: {
            enabled: true,
            sdkPath: './otel-node.js'
          }
        }
      },
      {
        name: 'browser',
        browser: { enabled: true },
        experimental: {
          openTelemetry: {
            enabled: true,
            sdkPath: './otel-browser.js'
          }
        }
      }
    ]
  }
})
```

**Pros:**
- Uses existing configuration structure
- Already supported in the codebase
- Clean separation via projects
- Most flexible approach

**Cons:**
- Requires separate projects for browser tests
- More verbose configuration
- May not fit all use cases

### Option 3: Automatic SDK Detection (Complex)
**Approach:** Detect environment and automatically choose appropriate SDK

**Implementation:**
- Detect if running in browser vs Node.js
- Import `@opentelemetry/sdk-trace-web` in browser
- Import `@opentelemetry/sdk-node` in Node.js
- Single `sdkPath` provides environment-agnostic initialization

**Pros:**
- Seamless user experience
- Single configuration
- "Just works" approach

**Cons:**
- High complexity
- Fragile environment detection
- Users lose control
- Hard to debug issues
- May not work with custom SDK setups

## Recommended Approach

**Combination of Option 1 and Option 2:**

1. **Primary recommendation:** Use per-project configuration (Option 2)
   - Leverage existing project-based config
   - Clear separation of browser vs Node.js
   - Most flexible for complex setups

2. **Fallback:** Add `browserSdkPath` for simpler cases (Option 1)
   - When user doesn't want separate projects
   - Single test suite with both Node.js and browser tests
   - Less configuration overhead

**Why this combination:**
- Issue author suggests: "Should we always require a separate project for browsers? `sdkPath` can already be specified in a project config."
- This implies per-project config is the preferred direction
- But having `browserSdkPath` provides escape hatch for simpler setups
- Author also notes: "Maybe this is mostly a documentation issue" - suggesting we should improve docs

## Implementation Plan (Revised Based on Architecture Analysis)

The implementation should follow a **phased approach**, starting with the Node.js orchestrator side first (easier, similar to existing PoolRunner), then moving to the browser client side (harder, requires Web SDK).

### Phase 1: Node.js Orchestrator Side (BrowserPool Tracing)

**Goal:** Add OpenTelemetry spans to the Node.js pool orchestrator (packages/vitest/src/node/pools/browser.ts), mirroring the pattern in poolRunner.ts.

#### Step 1.1: Add Traces Reference to BrowserPool
**File:** `packages/vitest/src/node/pools/browser.ts`

**Changes:**
1. Add `_traces: Traces` reference to BrowserPool class (similar to poolRunner.ts:81)
   - Initialize from `project.vitest._traces` in constructor

2. Add per-session OTEL state tracking (similar to poolRunner.ts:61-67):
   ```ts
   interface BrowserSessionOTEL {
     span: Span              // Session lifecycle span
     context: Context        // OpenTelemetry context for this session
     currentContext?: Context // Active span context
     files: string[]         // Files processed by this session
   }
   ```

3. Add `_sessionOTEL` map to track OTEL state per session:
   ```ts
   private _sessionOTEL = new Map<string, BrowserSessionOTEL>()
   ```

**Lines to modify:**
- Constructor (around line 179): Initialize `_traces` reference
- Add session OTEL tracking structure

#### Step 1.2: Create Browser Pool Span
**File:** `packages/vitest/src/node/pools/browser.ts`

**Changes:**
1. Create pool-level span in BrowserPool constructor (optional, for tracking entire pool)
   - Similar to `vitest.worker` span but named `vitest.browser.pool`
   - Set attributes: project name, max workers, origin URL

2. End pool span in pool cleanup/cancellation

**Lines to modify:**
- Constructor (line 179-185): Create pool span
- `cancel()` method (line 187-189): End pool span
- Pool cleanup in `createBrowserPool().close()` (line 152-162)

#### Step 1.3: Create Session Lifecycle Spans
**File:** `packages/vitest/src/node/pools/browser.ts`

**Changes:**
1. **Session start span** - Wrap `openPage()` (lines 250-264):
   ```ts
   private async openPage(sessionId: string) {
     const { span, context } = this._traces.startContextSpan('vitest.browser.session.start')
     this._sessionOTEL.set(sessionId, {
       span,
       context,
       files: []
     })

     try {
       span.setAttributes({
         'vitest.session.id': sessionId,
         'vitest.project': this.project.name,
         'vitest.browser.origin': this.options.origin
       })

       // ... existing openPage code ...

       span.end()
     } catch (error) {
       span.recordException(error)
       span.end()
       throw error
     }
   }
   ```

2. **Test execution spans** - Wrap `runNextTest()` (lines 292-355):
   - Create span for each test file execution
   - Named `vitest.browser.session.run`
   - Set attributes: file path, session ID

3. **Session cleanup span** - Wrap cleanup in `finishSession()` (lines 274-290):
   - End session lifecycle span
   - Record files processed

**Lines to modify:**
- `openPage()` (lines 250-264): Add session start span
- `runNextTest()` (lines 292-355): Add per-test spans
- `finishSession()` (lines 274-290): End session span

#### Step 1.4: Add Context Propagation Preparation
**File:** `packages/vitest/src/node/pools/browser.ts`

**Changes:**
1. Add method to extract OTEL carrier (similar to poolRunner.ts:149-154):
   ```ts
   private getOTELCarrier(sessionId: string) {
     const sessionOTEL = this._sessionOTEL.get(sessionId)
     const activeContext = sessionOTEL?.currentContext || sessionOTEL?.context
     return activeContext
       ? this._traces.getContextCarrier(activeContext)
       : undefined
   }
   ```

2. Store carrier for later propagation to orchestrator
   - Will be used in Phase 2 to pass to browser

**Lines to add:**
- New method `getOTELCarrier(sessionId: string)`
- Call in `runNextTest()` before orchestrator.createTesters()

#### Step 1.5: Wrap Provider Operations
**File:** `packages/vitest/src/node/pools/browser.ts`

**Changes:**
1. Wrap `provider.openPage()` call with span (in `openPage()` method):
   ```ts
   await this._traces.$(
     'vitest.browser.provider.openPage',
     { context: sessionOTEL?.context },
     () => browser.provider.openPage(sessionId, url.toString())
   )
   ```

2. Similar wrapping for other provider operations if any

**Lines to modify:**
- `openPage()` method (around line 259): Wrap provider.openPage()

### Phase 2: Browser Client Side (Web SDK Support)

**Goal:** Enable OpenTelemetry in the browser context using Web SDK.

**Note:** This phase can be deferred initially. Phase 1 alone will provide visibility into browser orchestration on the Node.js side, which is valuable even without browser-side tracing.

#### Step 2.1: Add Browser SDK Configuration
**File:** `packages/vitest/src/node/types/config.ts`

**Changes:**
1. Add optional `browserSdkPath` to `OpenTelemetryConfig`:
   ```ts
   openTelemetry?: {
     enabled: boolean
     sdkPath?: string
     browserSdkPath?: string  // NEW: For browser environment
   }
   ```

#### Step 2.2: Pass Trace Context to Browser
**File:** `packages/vitest/src/node/pools/browser.ts` (orchestrator communication)

**Changes:**
1. Pass `otelCarrier` to orchestrator when calling `createTesters()`
2. Need to investigate orchestrator RPC interface to see how to pass data

**TODO:** Research orchestrator communication mechanism:
- How is `createTesters()` defined?
- What's the RPC interface?
- Can we add trace context to the message?

#### Step 2.3: Browser Traces Initialization
**Files:**
- `packages/browser/src/client/tester/tester.ts:124-125`
- `packages/browser/src/client/tester/runner.ts:300-302`

**Changes:**
1. Remove TODO comments and explicit trace disabling
2. Initialize `Traces` instance with browser SDK
3. Extract context from orchestrator/page
4. Create spans for browser-side test execution

#### Step 2.4: SDK Resolution Logic
**File:** `packages/vitest/src/utils/traces.ts`

**Changes:**
1. Add environment detection (browser vs Node.js)
2. Use `browserSdkPath` when in browser context
3. Handle Web SDK initialization (different API than Node SDK)

**Note:** Based on the `vite-otel` demo, the browser SDK has a different interface:
- Node.js: `NodeSDK` with `sdk.start()` and `sdk.shutdown()`
- Browser: `WebTracerProvider` with `provider.register()` and `provider.shutdown()`
- Need to adapt the `Traces` class to handle both APIs

#### Step 2.5: Example Browser SDK File
**User's `otel-browser.js`** (based on vite-otel demo):

```js
import { WebTracerProvider, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    'service.name': 'vitest-browser'
  }),
  spanProcessors: [
    // Use SimpleSpanProcessor for immediate export in tests
    // (BatchSpanProcessor may not flush before test completion)
    new SimpleSpanProcessor(new OTLPTraceExporter({
      url: 'http://localhost:4318/v1/traces'
    }))
  ]
})

provider.register()

// Export provider with shutdown method for Vitest
export default {
  shutdown: async () => {
    await provider.shutdown()
  }
}
```

**Key differences from Node.js SDK:**
- `WebTracerProvider` instead of `NodeSDK`
- No `start()` method - use `register()` directly
- `SimpleSpanProcessor` recommended over `BatchSpanProcessor` for tests (immediate export)
- Same `shutdown()` interface can be maintained for compatibility

### Phase 3: Documentation

**Goal:** Document the new browser tracing capabilities.

#### Step 3.1: Update Existing Documentation
**File:** `docs/config/experimental.md`

**Changes:**
- Update warning about browser mode
  - Phase 1: Note that Node.js orchestrator tracing works
  - Phase 2: Remove warning entirely when browser SDK support is added
- Add examples of browser pool spans
- Document limitations (e.g., Phase 1 only traces orchestrator, not browser execution)

#### Step 3.2: Browser OpenTelemetry Guide (Phase 2 only)
**New file:** `docs/guide/browser-opentelemetry.md`

**Content:**
- Step-by-step setup guide
- Example `otel-browser.js` configuration
- Differences between Node.js and browser SDKs
- Context propagation explanation
- Troubleshooting common issues

#### Step 3.3: Example Projects (Phase 2 only)
**New directory:** `examples/browser-opentelemetry/`

**Files:**
- `vitest.config.ts` with browser tracing
- `otel-browser.js` with Web SDK setup
- `otel-node.js` with Node SDK setup
- `README.md` with explanation

### Phase 4: Testing & Validation

#### Step 4.1: Unit Tests
**Phase 1:**
- Test span creation in BrowserPool
- Test session OTEL state tracking
- Verify span attributes

**Phase 2:**
- Test `Traces` class with browser SDK
- Test SDK resolution logic
- Test context propagation to browser

#### Step 4.2: Integration Tests
**Phase 1:**
- Run browser tests with tracing enabled
- Verify spans are created for sessions
- Verify span hierarchy (pool → session → operations)
- Check span attributes and timing

**Phase 2:**
- Create test project with browser + OpenTelemetry
- Verify browser-side spans are created
- Verify parent-child relationships across Node.js ↔ browser boundary
- Verify SDK shutdown behavior

#### Step 4.3: Manual Testing
**Phase 1:**
- Export traces to Jaeger/OTLP
- Verify browser pool spans appear
- Check timing and relationships

**Phase 2:**
- Test with different browsers (Chromium, Firefox, WebKit)
- Verify no console errors
- Check browser SDK initialization

## Implementation Details

### Browser SDK Initialization (from vite-otel demo)

**User's `otel-browser.js`** (real working example):
```js
import { WebTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } from '@opentelemetry/sdk-trace-web'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { resourceFromAttributes } from '@opentelemetry/resources'

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({
    'service.name': 'vitest-browser',
  }),
  spanProcessors: [
    new SimpleSpanProcessor(new ConsoleSpanExporter()),  // Debug output
    new SimpleSpanProcessor(new OTLPTraceExporter()),    // Send to collector
  ],
})

provider.register({
  // Note: ZoneContextManager commented out in demo
  // May need investigation for async/await context propagation
  // contextManager: new ZoneContextManager(),
})

export default {
  shutdown: async () => {
    await provider.shutdown()
  }
}
```

**Important notes from demo:**
- Uses `SimpleSpanProcessor` instead of `BatchSpanProcessor` (immediate export for tests)
- `ConsoleSpanExporter` useful for debugging
- `ZoneContextManager` may need special handling (async/await transformation concerns)
- Provider shutdown is critical for flushing traces before test completion

### Configuration Examples

**Example 1: Single Project with Browser SDK Path**
```ts
export default defineConfig({
  test: {
    browser: { enabled: true },
    experimental: {
      openTelemetry: {
        enabled: true,
        browserSdkPath: './otel-browser.js'
      }
    }
  }
})
```

**Example 2: Multi-Project (Recommended)**
```ts
export default defineConfig({
  test: {
    projects: [
      {
        name: 'node',
        experimental: {
          openTelemetry: {
            enabled: true,
            sdkPath: './otel-node.js'
          }
        }
      },
      {
        name: 'browser',
        browser: { enabled: true, name: 'chromium' },
        experimental: {
          openTelemetry: {
            enabled: true,
            sdkPath: './otel-browser.js'
          }
        }
      }
    ]
  }
})
```

## Technical Considerations

### 1. Context Propagation in Browser

**Challenge:** How to pass trace context from Node.js orchestrator to browser page?

**Options:**
- **Option A:** Use page metadata/window object
  - Set `window.__VITEST_OTEL_CARRIER__` in page initialization
  - Browser tester reads from window

- **Option B:** Use HTTP headers (if using dev server)
  - Inject trace context headers in requests
  - Extract from request context

- **Option C:** Use postMessage API
  - Orchestrator sends carrier via MessagePort
  - Browser worker receives and initializes

**Recommended:** Option A (window object) - simplest and most reliable

### 2. SDK Bundling

**Challenge:** Browser SDK needs to be bundled/available in browser context

**Considerations:**
- User's `otel-browser.js` must be importable in browser
- May need to be included in Vite's build
- Dependencies must be browser-compatible
- No Node.js-specific APIs

**Solution:**
- Document that `otel-browser.js` should use browser-compatible packages
- Vite will handle bundling automatically
- Warn users about Node.js-only packages

### 3. Performance Impact

**Challenge:** OpenTelemetry adds overhead in browser

**Considerations:**
- Span creation has cost
- Exporter HTTP requests add network overhead
- May affect test timing

**Mitigations:**
- Use batch span processors (not simple processors)
- Document performance implications
- Allow disabling via config
- Consider sampling strategies

### 4. Multiple Browser Instances

**Challenge:** Browser mode may run multiple browser instances/contexts

**Considerations:**
- Each browser tab may need separate tracer
- Shared spans between instances?
- Context propagation across tabs?

**Solution:**
- Each browser context gets its own trace instance
- Spans are children of orchestrator span
- Document limitations

## Open Questions

1. **Should we support the same SDK for both Node.js and browser?**
   - Probably not - they have different APIs
   - But we should document the transition

2. **How to handle Worker threads in browser mode?**
   - Do web workers need separate traces?
   - How to propagate context to web workers?

3. **Should tracing be enabled by default in browser mode?**
   - Follow same behavior as Node.js mode (opt-in)
   - Require explicit configuration

4. **What spans should be created in browser mode?**
   - Similar to Node.js: browser lifecycle, test execution, hooks
   - Add browser-specific spans: navigation, page load, etc.?

5. **How to handle browser-specific events?**
   - Page navigation, resource loading, etc.
   - Should these be separate spans or events?

## Success Criteria

- [ ] Browser mode can initialize OpenTelemetry SDK
- [ ] Traces are exported from browser to collector
- [ ] Context propagation works from orchestrator to browser
- [ ] Configuration documented with examples
- [ ] No errors in console
- [ ] Works with all supported browsers (Chromium, Firefox, WebKit)
- [ ] Tests added to prevent regression
- [ ] Issue #9043 resolved

## Implementation Summary

This plan is divided into phases to allow for incremental progress:

**Phase 1 (Node.js Orchestrator - MVP):**
- ✅ **Valuable standalone:** Provides visibility into browser pool orchestration without requiring browser SDK
- 🎯 **Easier to implement:** Mirrors existing PoolRunner pattern, no Web SDK complexity
- 📊 **Immediate benefits:** Shows session lifecycle, provider operations, test queue management
- ⚠️ **Limitation:** Does not trace actual test execution in browser

**Phase 2 (Browser Client - Full Solution):**
- 🔧 **More complex:** Requires Web SDK, different initialization, context propagation across boundary
- 🌐 **Complete solution:** Traces test execution inside browser
- 🔄 **Depends on Phase 1:** Uses context from Phase 1 spans

**Recommendation:** Start with Phase 1 as MVP. Phase 2 can be a follow-up PR based on user feedback and demand.

## Timeline Estimate (Revised)

### Phase 1: Node.js Orchestrator Tracing (MVP)
- **Step 1.1-1.2 (Traces setup):** 0.5 days
  - Add traces reference and pool span to BrowserPool
  - Simple, mirrors PoolRunner pattern

- **Step 1.3 (Session spans):** 1 day
  - Wrap openPage, runNextTest, finishSession with spans
  - Handle error cases and attributes

- **Step 1.4-1.5 (Context + provider spans):** 0.5 days
  - Add getOTELCarrier method
  - Wrap provider operations

- **Testing & Documentation:** 1 day
  - Unit tests for span creation
  - Integration test with browser mode
  - Update docs to note Node.js side works

**Phase 1 Total:** 3 days

### Phase 2: Browser Client Tracing (Full Solution)
- **Config + SDK resolution:** 1 day
  - Add browserSdkPath config
  - Update Traces class for browser environment

- **Context propagation:** 1-2 days
  - Research orchestrator RPC mechanism
  - Pass carrier to browser
  - Extract context in browser

- **Browser SDK initialization:** 1-2 days
  - Remove trace disabling
  - Initialize Web SDK
  - Create browser-side spans

- **Testing & Documentation:** 1-2 days
  - Integration tests with Web SDK
  - Documentation and examples
  - Multi-browser testing

**Phase 2 Total:** 4-7 days

**Overall Total:** 7-10 days (3 days MVP + 4-7 days full solution)

## References

### Issue & Documentation
- Issue: https://github.com/vitest-dev/vitest/issues/9043
- OpenTelemetry Web SDK: https://opentelemetry.io/docs/instrumentation/js/getting-started/browser/

### Code References
- Current Node.js implementation: `packages/vitest/src/utils/traces.ts`
- Node.js pool with tracing: `packages/vitest/src/node/pools/poolRunner.ts`
- Browser pool (needs tracing): `packages/vitest/src/node/pools/browser.ts`
- Browser runner: `packages/browser/src/client/tester/runner.ts:300-302`
- Browser tester: `packages/browser/src/client/tester/tester.ts:124-125`

### Demo Projects

#### Vitest OTEL Demo (Node.js mode)
**Location:** https://github.com/hi-ogawa/reproductions/tree/main/vitest-otel

**What it shows:**
- Working example of current Vitest OpenTelemetry integration
- Node.js worker tracing with `@opentelemetry/sdk-node`
- Simple configuration: `vitest.config.ts` with `sdkPath: "./otel.js"`
- Uses `NodeSDK`, `OTLPTraceExporter`, auto-instrumentations
- Exports traces to Jaeger via OTLP HTTP
- **Note:** "Browser mode test runtime traces are not implemented yet" (this is what issue #9043 is about)

**Key files:**
- `vitest.config.ts`: Enables `experimental.openTelemetry` with `sdkPath`
- `otel.js`: Node.js SDK initialization with Jaeger export
- Shows proper SDK shutdown via `export default sdk`

#### Vite Client App OTEL Demo
**Location:** https://github.com/hi-ogawa/reproductions/tree/main/vite-otel

**What it shows:**
- OpenTelemetry Web SDK in browser/client app (this is what Phase 2 would use)
- Uses `@opentelemetry/sdk-trace-web` (browser-compatible)
- Manual span creation with tracer API
- Reference implementation for browser-side tracing

**Key learnings:**

1. **Browser SDK Setup** (`src/otel.ts`):
   ```ts
   import { WebTracerProvider, SimpleSpanProcessor, ConsoleSpanExporter } from "@opentelemetry/sdk-trace-web"
   import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto"

   const provider = new WebTracerProvider({
     resource: resourceFromAttributes({ "service.name": "my-app" }),
     spanProcessors: [
       new SimpleSpanProcessor(new ConsoleSpanExporter()),  // Debug console
       new SimpleSpanProcessor(new OTLPTraceExporter()),     // Send to Jaeger
     ],
   })

   provider.register({
     // contextManager: new ZoneContextManager(),  // Commented - needs investigation
   })
   ```

2. **Manual Span Creation** (`src/otel-utils.ts`):
   - Uses `trace.getTracer("default")` to get tracer
   - `tracer.startActiveSpan(name, { attributes }, callback)` for span creation
   - Implements `recordTrace` utility similar to Vitest's internal `Traces.$()` method
   - Handles both sync and async callbacks
   - Records exceptions and sets error status

3. **Usage Example** (`src/counter.ts`):
   ```ts
   recordTrace({
     name: "button_click",
     attributes: { button_id: "counter", value: counter },
     fn: () => setCounter(counter + 1),
   })
   ```

4. **Dependencies** (browser-specific):
   - `@opentelemetry/sdk-trace-web` (NOT sdk-node)
   - `@opentelemetry/exporter-trace-otlp-proto` (HTTP-based, works in browser)
   - `@opentelemetry/resources` (for service metadata)
   - No auto-instrumentations (manual tracing only)

5. **Open Questions** (from vite-otel README):
   - Does `ZoneContextManager` work out of the box? (May need async/await transformation)
   - Should OTEL packages be optimized by Vite's dependency pre-bundling?
   - TODO: Implement provider shutdown for cleanup

**Implications for Vitest Browser Mode:**
- Phase 2 would need similar Web SDK setup in browser tester
- Context propagation from Node.js orchestrator → browser page will be key
- Browser tester would create spans for test execution, similar to Node.js worker
- Can export directly to OTLP collector from browser (no need to route through Node.js)
- Need to handle provider shutdown when tests complete

## Concrete Implementation Insights (from demos)

After examining the working demos, here are concrete takeaways:

### What Works Today (vitest-otel)
- Node.js mode tracing is fully functional
- Simple config: `experimental.openTelemetry.enabled + sdkPath`
- Uses `@opentelemetry/sdk-node` with auto-instrumentations
- Exports to Jaeger via OTLP HTTP (port 4318)
- Proper SDK lifecycle: `sdk.start()` on init, `export default sdk` for shutdown

### What Browser Implementation Needs (from vite-otel)

1. **Different SDK package:**
   - `@opentelemetry/sdk-trace-web` (NOT sdk-node)
   - `WebTracerProvider` (NOT NodeSDK)

2. **Different initialization pattern:**
   ```ts
   // Node.js:
   const sdk = new NodeSDK({ ... })
   sdk.start()
   export default sdk  // Has shutdown() method

   // Browser:
   const provider = new WebTracerProvider({ ... })
   provider.register()  // No start() method
   export default { shutdown: () => provider.shutdown() }  // Wrap shutdown
   ```

3. **Span processors matter:**
   - Use `SimpleSpanProcessor` for tests (immediate export)
   - Avoid `BatchSpanProcessor` (may not flush before test ends)
   - Can use multiple processors (ConsoleSpanExporter + OTLPTraceExporter)

4. **Manual span creation:**
   - Browser apps use `trace.getTracer()` + `startActiveSpan()`
   - No auto-instrumentations available (or needed) in browser
   - Similar pattern to Vitest's internal `Traces.$()` helper

5. **Context management:**
   - `ZoneContextManager` exists but has open questions
   - May need async/await transformation support
   - Can work without it for basic tracing

6. **Vite considerations:**
   - OTEL packages need to be bundled for browser
   - Question: Should they be optimized/pre-bundled?
   - Vite handles this automatically, but may affect performance

### Practical Next Steps for Implementation

**Phase 1 (Immediate - Node.js side only):**
1. Add `_traces` reference to BrowserPool class
2. Create spans around `openPage()`, `runNextTest()`, `finishSession()`
3. Mirror the pattern from PoolRunner (already proven to work)
4. Test with existing vitest-otel demo setup

**Phase 2 (Later - Browser client):**
1. Research how to pass OTEL carrier to orchestrator/browser
2. Create browser SDK configuration (similar to vite-otel demo)
3. Initialize Web SDK in browser tester
4. Create spans for browser-side test execution
5. Handle provider shutdown properly

## Next Steps

1. **Discuss phased approach with maintainers:**
   - Validate Phase 1 (Node.js orchestrator only) as acceptable MVP
   - Confirm that partial tracing (without browser client) provides value
   - Get feedback on span naming and hierarchy
   - Discuss whether Phase 2 should be separate PR or same PR

2. **Start with Phase 1 implementation:**
   - Add traces reference to BrowserPool (Step 1.1)
   - Create session lifecycle spans (Step 1.3)
   - Test with existing browser tests
   - Validate span output in Jaeger/OTLP

3. **Evaluate before Phase 2:**
   - Get user feedback on Phase 1 value
   - Assess if browser client tracing is needed
   - Research orchestrator RPC communication for Phase 2
   - Decide on configuration approach (per-project vs browserSdkPath)

4. **Phase 2 (if approved):**
   - Implement browser SDK support
   - Add full context propagation
   - Complete documentation and examples

## Key Insights from Analysis

1. **Architecture is already parallel:**
   - PoolRunner (Node.js workers) ↔ BrowserPool (browser sessions)
   - Both manage test execution, just different runtimes
   - Tracing patterns can be mirrored

2. **Start Node.js side first:**
   - Much easier - same environment as existing tracing
   - Provides immediate value (orchestration visibility)
   - No Web SDK complexity
   - Can be done independently

3. **Browser client is separate concern:**
   - Requires different SDK (@opentelemetry/sdk-trace-web)
   - Different initialization and bundling
   - Context propagation across environments
   - Can be deferred to Phase 2

4. **MVP is valuable:**
   - Seeing browser pool lifecycle is useful on its own
   - Shows session creation, test queue, timing
   - Helps debug browser mode issues
   - Doesn't require users to set up browser SDK
