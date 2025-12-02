# Issue #9135: FormData with Blob hangs in jsdom environment

**Issue**: https://github.com/vitest-dev/vitest/issues/9135

## Summary

Tests using `FormData` with `Blob` or `File` hang/timeout when running in jsdom environment on Node.js 24.6+. The issue is related to changes in undici 7.13.0 (included in Node.js 24.6).

## Environment

- **Works**: Node.js 24.5 (undici 7.12.0)
- **Fails**: Node.js 24.6+ (undici 7.13.0)

## Root Cause

### undici PR #4362: Remove node:buffer imports

**PR**: https://github.com/nodejs/undici/pull/4362

**Before (undici 7.12.0)**:
```javascript
const { File: NodeFile } = require('node:buffer')
const { Blob } = require('node:buffer')
// Explicitly uses Node.js native implementations
```

**After (undici 7.13.0)**:
```javascript
// Uses globalThis.File and globalThis.Blob directly
// Vulnerable to environment modifications
```

### The Timing Problem

1. **Module load time**: undici module loads and captures references to `globalThis.File`, `globalThis.Blob` (Node.js native implementations)

2. **Test setup time**: vitest sets up jsdom, which may override globals:
   ```javascript
   global.Blob = dom.window.Blob // jsdom's Blob (incomplete implementation)
   global.File = dom.window.File // jsdom's File (incomplete implementation)
   ```

3. **Runtime**: undici has inconsistent references:
   - Some code uses **cached top-level** `File`/`Blob` references (Node.js native)
   - Other code performs `instanceof globalThis.File` checks (now jsdom's File)
   - **Class mismatch**: jsdom Blob instances don't match Node.js Blob class

### jsdom Blob Limitations

jsdom's Blob implementation is incomplete:
- ❌ No `stream()` method
- ❌ No `arrayBuffer()` method
- ❌ No `text()` method
- ✅ Only has: `size`, `type`, `slice()`

**Issue**: https://github.com/jsdom/jsdom/issues/2555

When undici tries to stream a jsdom Blob for FormData body, it hangs because the stream methods don't exist or don't work properly.

## Reproduction

```javascript
// @vitest-environment jsdom

import { describe, test } from "vitest";

describe("FormData", () => {
  test(".formData() with File", { timeout: 2000 }, async () => {
    const formData = new FormData();
    formData.set("file", new Blob(["test"]), "test.txt");

    const request = new Request("http://localhost/", {
      method: "POST",
      body: formData,
    });

    // This hangs - only FormData headers are sent, blob content never arrives
    await request.body!.pipeTo(new WritableStream({
      write(chunk) {
        console.log("chunk", chunk.length);
      }
    }));
  });
});
```

**Output**:
```
chunk 140  // FormData headers
chunk 2    // CRLF separator
chunk 38   // Closing boundary
// Missing: actual blob content!
// Test times out waiting for stream to complete
```

## Current Workaround Investigation

Experimenting with overriding jsdom globals with Node.js native implementations:

```javascript
// In packages/vitest/src/integrations/env/jsdom.ts
global.Blob = NodeBlob_ // Node.js native Blob
global.File = (await import('node:buffer')).File // Node.js native File
global.FormData = NodeFormData_ // Node.js native FormData
```

However, this creates its own complications with jsdom's class consistency expectations.

## Why This is Complex

Simply overriding all globals doesn't work because:

1. **jsdom creates its own class instances** in user test code
2. **Node.js's Request/fetch** (from undici) expects Node.js class instances
3. **instanceof checks fail** across the boundary: `jsdomBlob instanceof NodeBlob === false`
4. **Not all classes can be simply replaced** - jsdom doesn't implement Request, but does implement Blob/File/FormData

This is why vitest has conversion functions like:
- `makeCompatBlob()` - converts jsdom Blob → Node.js Blob
- `makeCompatFormData()` - converts jsdom FormData → Node.js FormData
- `createCompatRequest()` - wraps Node.js Request with conversion logic

## Potential Solutions

### Option 1: Report to undici
- Argue that relying on `globalThis` makes undici fragile in test environments
- Request restoration of explicit `node:buffer` imports
- Or request that undici captures references more defensively

### Option 2: Workaround in vitest
- Prevent jsdom from overriding `global.Blob`/`global.File`
- Keep Node.js native implementations in globals
- Map jsdom's internal Blobs more aggressively

### Option 3: Document limitation
- Note that jsdom + FormData + Blob doesn't work on Node 24.6+
- Recommend using `@vitest-environment node` for such tests
- Wait for jsdom to implement proper Blob methods

## Related Links

- **Vitest Issue**: https://github.com/vitest-dev/vitest/issues/9135
- **undici PR #4362**: https://github.com/nodejs/undici/pull/4362 (Remove node:buffer imports)
- **undici v7.13.0 Release**: https://github.com/nodejs/undici/releases/tag/v7.13.0
- **jsdom Blob Issue**: https://github.com/jsdom/jsdom/issues/2555 (Implement Blob stream(), text(), arrayBuffer())
- **Node.js 24.6.0 Release**: https://nodejs.org/en/blog/release/v24.6.0

## Undici Code Analysis

### Type Assertion Captured at Module Load

In `undici/lib/web/webidl/index.js` at line 531:

```javascript
webidl.is.Blob = webidl.util.MakeTypeAssertion(Blob)
```

This captures a reference to `Blob` class at **module load time**. Before PR #4362, this was `require('node:buffer').Blob`. After PR #4362, this is `globalThis.Blob`.

### FormData Stream Generation

In `undici/lib/web/fetch/body.js`, when processing FormData:

1. **Lines 134-147**: Iterate over FormData entries and build `blobParts`:
   ```javascript
   for (const [name, value] of object) {
     // ...
     blobParts.push(chunk, value, rn) // value is Blob/File from FormData
   }
   ```

2. **Lines 169-177**: Async generator yields from blobParts:
   ```javascript
   action = async function* () {
     for (const part of blobParts) {
       if (part.stream) {
         yield* part.stream() // ← CRITICAL: Calls .stream() on the Blob
       }
       else {
         yield part
       }
     }
   }
   ```

**The hang occurs at line 172** when calling `part.stream()` on a jsdom Blob (which lacks proper `.stream()` implementation).

### New Blob Construction

Line 334 in body.js:
```javascript
return new Blob([bytes], { type: mimeType })
```

This uses `globalThis.Blob`, so after jsdom setup, this creates a **jsdom Blob** instead of Node Blob.

## The Actual Bug: FormData.append Re-wraps Blobs

### The Complete Flow

1. **User test code** (jsdom environment):
   ```javascript
   const blob = new Blob(['test']) // jsdom Blob
   formData.set('file', blob, 'test.txt') // jsdom FormData
   new Request(url, { body: formData })
   ```

2. **Vitest's compat layer intercepts** (`packages/vitest/src/integrations/env/jsdom.ts`):
   ```javascript
   // createCompatRequest checks: init.body instanceof utils.window.FormData
   // Calls: utils.makeCompatFormData(init.body)
   ```

3. **makeCompatFormData converts** (lines 289-300):
   ```javascript
   const nodeFormData = new NodeFormData_() // Node.js FormData
   formData.forEach((value, key) => {
     if (value instanceof window.Blob) {
       nodeFormData.append(key, utils.makeCompatBlob(value)) // ← Converts jsdom Blob to Node Blob
     }
   })
   ```

4. **makeCompatBlob extracts data** (lines 302-309):
   ```javascript
   const buffer = (blob as any)[implSymbol]._buffer
   return new NodeBlob_([buffer], { type: blob.type })  // Node.js Blob with data
   ```

5. **BUT: undici's FormData.append re-wraps!** (`undici/lib/web/fetch/formdata.js` lines 32-46):
   ```javascript
   append(name, value, filename) {
     // ...
     if (arguments.length === 3 || webidl.is.Blob(value)) {
       value = webidl.converters.Blob(value, prefix, 'value')  // Validates it's a Blob
     }
     const entry = makeEntry(name, value, filename)  // ← THE PROBLEM
   }
   ```

6. **makeEntry wraps Blobs in File** (`undici/lib/web/fetch/formdata.js` lines 223-255):
   ```javascript
   function makeEntry(name, value, filename) {
     if (typeof value !== 'string') {
       // If not already a File, wrap the Blob in a File
       if (!webidl.is.File(value)) {
         value = new File([value], 'blob', { type: value.type }) // ← Uses globalThis.File!
       }

       // If filename provided, create new File with that name
       if (filename !== undefined) {
         value = new File([value], filename, options) // ← Uses globalThis.File!
       }
     }
     return { name, value }
   }
   ```

7. **After jsdom setup, `globalThis.File` is jsdom's File**:
   - `new File([nodeBlob], filename)` creates a **jsdom File** wrapping the Node Blob
   - jsdom File lacks proper `.stream()` implementation
   - When undici tries to stream it at `body.js:172`, it hangs

### The Critical Issue

Even though vitest successfully converts jsdom Blob → Node Blob, **undici's FormData.append() immediately wraps it in `new File()` using `globalThis.File`**, which after jsdom setup creates a jsdom File.

Before PR #4362, undici used `require('node:buffer').File` explicitly, so it would always create Node.js Files. After PR #4362, it uses the bare `File` reference which resolves to `globalThis.File`.

## The Workaround: Temporarily Restore Node.js File

Since undici's `FormData.append()` uses `globalThis.File` to create File objects, we can work around this by temporarily restoring the Node.js File constructor during the append operations.

**Implementation** (`packages/vitest/src/integrations/env/jsdom.ts`):

```javascript
let NodeFile_!: typeof File

// Capture Node.js File before jsdom pollutes globals
async setup(global, { jsdom = {} }) {
  NodeFormData_ = globalThis.FormData
  NodeBlob_ = globalThis.Blob
  NodeFile_ = globalThis.File  // ← Save Node.js File
  NodeRequest_ = globalThis.Request
  // ... jsdom setup ...
}

makeCompatFormData(formData: FormData) {
  const nodeFormData = new NodeFormData_()

  // Temporarily restore Node.js File during append
  // https://github.com/nodejs/undici/blob/main/lib/web/fetch/formdata.js#L237
  globalThis.File = NodeFile_

  formData.forEach((value, key) => {
    if (value instanceof window.Blob) {
      nodeFormData.append(key, utils.makeCompatBlob(value))
    } else {
      nodeFormData.append(key, value)
    }
  })

  // Restore jsdom's File
  globalThis.File = window.File

  return nodeFormData
}
```

**Why this works**:
1. We capture `NodeFile_` at module init, before jsdom pollutes `globalThis.File`
2. Before calling `nodeFormData.append()`, we temporarily set `globalThis.File = NodeFile_`
3. When undici's `makeEntry` internally calls `new File([blob], filename)`, it uses Node.js's File
4. Node.js File properly wraps the Node.js Blob and has working `.stream()` method
5. After all appends, we restore jsdom's File so user code continues to work normally

**Caveats**:
- This is a hacky workaround that mutates globals
- Potential race condition if async code accesses `globalThis.File` during the swap (unlikely in this synchronous path)
- Relies on undici's internal implementation details
- Proper fix should be in undici (restore explicit `node:buffer` imports or capture File at module load)

## Notes

- The issue is fundamentally about **timing and module initialization order**
- undici's change from explicit imports to `globalThis` made it vulnerable to environment modifications
- undici captures type assertions at module load (before jsdom setup)
- **undici constructs new Files during FormData.append() using globalThis (after jsdom setup)** ← Root cause
- This creates an inconsistent state with mixed Blob/File classes
- This is an interaction bug between undici, vitest, and jsdom
- Vitest can work around it by temporarily restoring Node.js File during FormData operations
- A proper long-term fix requires changes to undici
