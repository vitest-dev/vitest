# Issue 8646 - userEvent.upload File Input Reproduction

This example demonstrates the issue reported in [#8646](https://github.com/vitest-dev/vitest/issues/8646).

## Summary

When using `userEvent.upload()` with a bare `<input type="file">` element (no id, label, or data-testid), the test may timeout. **This is a bug in ivya** - it is out of sync with upstream Playwright.

## The Problem

When using `userEvent.upload()` with a file input element that lacks unique identifiers, the test may fail with:

```
locator.setInputFiles: Timeout 899ms exceeded.
```

### Original Failing Code

```typescript
const input = document.createElement("input");
input.type = "file";
document.body.appendChild(input);

// This may timeout
await userEvent.upload(input, new File(["hello"], "hello.png", { type: "image/png" }));
```

The input has no:

- `id` attribute
- associated `<label>` element
- `data-testid` attribute

Without these identifiers, ivya (the locator library) generates a role-based selector (`internal:role=textbox`) which may not match the element in Chromium's accessibility tree.

## How to Avoid This Issue

Adding identifiers to the input element ensures ivya generates specific selectors. Any of these approaches work:

### Option 1: Add an `id` Attribute

```typescript
const input = document.createElement("input");
input.type = "file";
input.id = "file-upload"; // ✅ Add an id
document.body.appendChild(input);

await userEvent.upload(input, file); // ✅ Works!
```

### Option 2: Associate with a Label

```typescript
const label = document.createElement("label");
label.textContent = "Upload file";
label.htmlFor = "file-input";

const input = document.createElement("input");
input.type = "file";
input.id = "file-input"; // ✅ Connected via label's htmlFor

document.body.appendChild(label);
document.body.appendChild(input);

await userEvent.upload(input, file); // ✅ Works!
```

### Option 3: Add a `data-testid` Attribute

```typescript
const input = document.createElement("input");
input.type = "file";
input.setAttribute("data-testid", "file-upload"); // ✅ Add a test id
document.body.appendChild(input);

await userEvent.upload(input, file); // ✅ Works!
```

## Why This Happens

### Technical Background

When vitest/browser converts an HTML element to a locator, it uses the [ivya](https://github.com/sheremet-va/ivya) library (a fork of Playwright's locator resolution) to generate a selector.

**Why selectors are needed**: Tests run in a browser iframe, but Playwright runs in a separate Node.js process. DOM element references cannot cross process boundaries, so vitest must serialize the element as a selector string.

**How ivya generates selectors**: ivya produces multiple candidate selectors with scores, then chooses the best one. For a bare `<input type="file">`, candidates include:

- `internal:role=textbox` (score 510 - preferred)
- `input[type="file"]` (score 520)
- `input` (score 521)

The role-based selector is preferred, but ivya maps `<input type="file">` to `role="textbox"` as a fallback:

```typescript
// ivya/src/roleUtils.ts lines 176-201
INPUT: (e: Element) => {
  const type = (e as HTMLInputElement).type.toLowerCase();
  // ... checks for button, checkbox, radio, etc ...
  return (
    {
      button: "button",
      checkbox: "checkbox",
      // ...
    }[type] || "textbox"
  ); // <-- type="file" falls through to 'textbox'
};
```

If Chromium's accessibility tree doesn't match file inputs with `role="textbox"`, the selector fails to find the element.

### Playwright has already fixed this

Playwright (which ivya is forked from) has explicit handling for file inputs:

```typescript
// playwright/packages/injected/src/roleUtils.ts lines 135-139
// File inputs do not have a role by the spec: https://www.w3.org/TR/html-aam-1.0/#el-input-file.
// However, there are open issues about fixing it: https://github.com/w3c/aria/issues/1926.
// All browsers report it as a button, and it is rendered as a button, so we do "button".
if (type === 'file')
  return 'button';
```

**ivya is out of sync with upstream Playwright.** The fix exists in Playwright - ivya just hasn't picked it up.

### Technical Details

- **Playwright 1.52.0** ships with **Chromium 136.0.7103.25** ([source](https://github.com/microsoft/playwright/releases/tag/v1.52.0))
- According to [W3C HTML-ARIA](https://github.com/w3c/html-aria/issues/126), `<input type="file">` has **no implied ARIA role**
- The W3C [ARIA working group](https://github.com/w3c/aria/issues/1926) has an open issue to define a role for file inputs

---

## Conclusion

**This is a bug in ivya.** ivya is out of sync with upstream Playwright, which already has the fix.

ivya should sync with Playwright's handling of file inputs, which returns `'button'` instead of falling through to `'textbox'`.

## Running This Example

```bash
# Install dependencies
pnpm install

# Run the tests
pnpm test
```

All tests in this example should pass, demonstrating that adding identifiers avoids the timeout issue.

## References

- [GitHub Issue #8646](https://github.com/vitest-dev/vitest/issues/8646) - Original bug report
- [ivya roleUtils.ts](https://github.com/sheremet-va/ivya/blob/main/src/roleUtils.ts#L176-L201) - INPUT element role mapping (outdated)
- [Playwright roleUtils.ts](https://github.com/microsoft/playwright/blob/main/packages/injected/src/roleUtils.ts#L135-L139) - File input handling (fixed)
- [Playwright 1.52.0 Release Notes](https://github.com/microsoft/playwright/releases/tag/v1.52.0) - Chromium 136 bundled
- [W3C HTML-AAM: input type="file"](https://www.w3.org/TR/html-aam-1.0/#el-input-file) - No role mapping
- [W3C HTML-ARIA: input type="file" role](https://github.com/w3c/html-aria/issues/126) - No implied ARIA role
- [W3C ARIA: file input role proposal](https://github.com/w3c/aria/issues/1926) - Open discussion
- [Vitest Browser Mode Locators](https://vitest.dev/api/browser/locators) - Official documentation
- [Playwright Locators](https://playwright.dev/docs/locators) - Selector syntax reference
