# Issue 8646 - userEvent.upload File Input Reproduction

This example demonstrates the issue reported in [#8646](https://github.com/vitest-dev/vitest/issues/8646) and its solutions.

## Summary

**This is not a bug in vitest or ivya.** This is a user error caused by not following accessibility best practices combined with a behavior change in Chromium 136+.

## The Problem

When using `userEvent.upload()` with a file input element that has **low semantic specificity**, the test fails with:

```
locator.setInputFiles: Timeout 899ms exceeded.
```

This issue emerged with Chromium 136+ (shipped in Playwright 1.52.0) because these versions changed how `<input type="file">` elements are exposed in the accessibility tree. Previously, file inputs were exposed as "textbox" elements, but this is no longer the case in newer Chromium versions.

### Original Failing Code

```typescript
const input = document.createElement('input')
input.type = 'file'
document.body.appendChild(input)

// This times out in newer Chromium versions (136+)
await userEvent.upload(input, new File(['hello'], 'hello.png', { type: 'image/png' }))
```

The input has no:
- `id` attribute
- associated `<label>` element
- `data-testid` attribute
- accessible name

Because of this, vitest/browser generates a generic locator (equivalent to `role="textbox"`), which no longer matches file inputs in newer Chromium versions.

## Solutions

To fix this issue, provide **higher semantic specificity** to the input element. Any of these approaches work:

### Solution 1: Add an `id` Attribute

```typescript
const input = document.createElement('input')
input.type = 'file'
input.id = 'file-upload'  // ✅ Add an id
document.body.appendChild(input)

await userEvent.upload(input, file)  // ✅ Works!
```

### Solution 2: Associate with a Label

```typescript
const label = document.createElement('label')
label.textContent = 'Upload file'
label.htmlFor = 'file-input'

const input = document.createElement('input')
input.type = 'file'
input.id = 'file-input'  // ✅ Connected via label's htmlFor

document.body.appendChild(label)
document.body.appendChild(input)

await userEvent.upload(input, file)  // ✅ Works!
```

### Solution 3: Add a `data-testid` Attribute

```typescript
const input = document.createElement('input')
input.type = 'file'
input.setAttribute('data-testid', 'file-upload')  // ✅ Add a test id
document.body.appendChild(input)

await userEvent.upload(input, file)  // ✅ Works!
```

## Why This Happens

**This is not a bug in vitest/browser or ivya.** The behavior change occurred at the browser level:

1. **Playwright 1.51.0 and earlier**: Shipped with Chromium versions that exposed `<input type="file">` as a "textbox" in the accessibility tree
2. **Playwright 1.52.0+**: Ships with Chromium 136+, which no longer exposes file inputs as textboxes in the accessibility tree
3. **vitest/browser and ivya**: Rely on the accessibility tree to locate elements (following Playwright's pattern), so they are affected by this Chromium change

The solution is to follow **accessibility best practices**: always provide semantic specificity to form elements so they can be reliably located and are accessible to assistive technologies.

### Why the change in Chromium matters

When an input element lacks semantic specificity (no id, no label, no testid, etc.), vitest/browser's locator generation creates a generic selector. For a bare `<input type="file">` without any identifying features, this often results in a selector equivalent to `role="textbox"`. This worked in older Chromium versions because file inputs were exposed as textboxes in the accessibility tree. In Chromium 136+, file inputs are no longer exposed this way, so the generic locator fails to find the element.

By adding an `id`, `data-testid`, or associating with a `<label>`, the element becomes uniquely identifiable, and vitest/browser can generate a specific, stable selector that doesn't rely on the element's role in the accessibility tree.

## Running This Example

```bash
# Install dependencies
pnpm install

# Run the tests
pnpm test
```

All tests in this example should pass, demonstrating that the solutions work correctly.

## Key Takeaway

**Always provide semantic specificity to your input elements** by:
- Adding an `id` attribute
- Associating with a `<label>` element
- Adding a `data-testid` attribute for testing
- Providing an `aria-label` or other accessible name

This makes your tests more reliable and your application more accessible.
