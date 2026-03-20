---
title: ARIA Snapshots | Guide
outline: deep
---

# ARIA Snapshots

ARIA snapshots let you test the accessibility structure of your pages. Instead of asserting against raw HTML or visual output, you assert against the accessibility tree — the same structure that screen readers and other assistive technologies use.

Given this HTML:

```html
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

You can assert its accessibility tree:

```ts
await expect.element(page.getByRole('navigation')).toMatchAriaInlineSnapshot(`
  - navigation "Main":
    - link "Home":
      - /url: /
    - link "About":
      - /url: /about
`)
```

This catches accessibility regressions: missing labels, broken roles, incorrect heading levels, and more — things that DOM snapshots would miss.

## Snapshot Workflow

ARIA snapshots use the same Vitest snapshot workflow as other snapshot assertions. File snapshots, inline snapshots, `--update` / `-u`, watch mode updates, and CI snapshot behavior all work the same way.

See the main [Snapshot guide](/guide/snapshot) for the general snapshot workflow, update behavior, and review guidelines.

## Basic Usage

Given a page with this HTML:

```html
<form aria-label="Log In">
  <input aria-label="Email" />
  <input aria-label="Password" type="password" />
  <button>Submit</button>
</form>
```

### File Snapshots

Use `toMatchAriaSnapshot()` to store the snapshot in a `.snap` file alongside your test:

```ts
import { expect, test } from 'vitest'

test('login form', async () => {
  await expect.element(page.getByRole('form')).toMatchAriaSnapshot()
})
```

On first run, Vitest generates a snapshot file entry:

```yaml
- form "Log In":
    - textbox "Email"
    - textbox "Password"
    - button "Submit"
```

### Inline Snapshots

Use `toMatchAriaInlineSnapshot()` to store the snapshot directly in the test file:

```ts
import { expect, test } from 'vitest'

test('login form', async () => {
  await expect.element(page.getByRole('form')).toMatchAriaInlineSnapshot(`
    - form "Log In":
      - textbox "Email"
      - textbox "Password"
      - button "Submit"
  `)
})
```

## Browser Mode Retry Behavior

In [Browser Mode](/guide/browser/), `expect.element()` polls the DOM and waits for the accessibility tree to **stabilize** before evaluating the result. On each poll, the matcher re-queries the element and re-captures the accessibility tree. The snapshot is considered stable when two consecutive polls produce the same output.

```ts
await expect.element(page.getByRole('form')).toMatchAriaInlineSnapshot(`
  - form "Log In":
    - textbox "Email"
    - textbox "Password"
    - button "Submit"
`)
```

On first run or with `--update`, the stable result is written as the new snapshot.

When an existing snapshot is present, the matcher also checks whether the stable result matches. If it does not, polling resets and continues — giving the DOM time to reach the expected state. This handles cases like animations, async rendering, or delayed state updates where the tree may briefly stabilize in an intermediate state before settling into its final form.

## Preserving Hand-Edited Patterns

When you hand-edit a snapshot to use regex patterns, those patterns survive `--update`. Only the literal parts that changed are overwritten. This lets you write flexible assertions that don't break when content changes.

### Example

**Step 1.** Your shopping cart page renders this HTML:

```html
<h1>Your Cart</h1>
<ul aria-label="Cart Items">
  <li>Wireless Headphones — $79.99</li>
</ul>
<button>Checkout</button>
```

You run your test for the first time with `--update`. Vitest generates the snapshot:

```yaml
- heading "Your Cart" [level=1]
- list "Cart Items":
    - listitem: Wireless Headphones — $79.99
- button "Checkout"
```

**Step 2.** The item names and prices are seeded test data that may change. You hand-edit those lines to regex patterns, but keep the stable structure as literals:

```yaml
- heading "Your Cart" [level=1]
- list "Cart Items":
    - listitem: /.+ — \$\d+\.\d+/
- button "Checkout"
```

**Step 3.** Later, a developer renames the button from "Checkout" to "Place Order". Running `--update` updates that literal but preserves your regex patterns:

```yaml
- heading "Your Cart" [level=1]
- list "Cart Items":
    - listitem: /.+ — \$\d+\.\d+/
- button "Place Order"   👈 New snapshot updated with new string
```

The regex patterns you wrote in step 2 are preserved because they still match the actual content. Only the mismatched literal "Checkout" was updated to "Place Order".

## Snapshot Format

ARIA snapshots use a YAML-like syntax. Each line represents a node in the accessibility tree.

::: info
ARIA snapshot templates use a **subset of YAML** syntax. Only the features needed for accessibility trees are supported: scalar values, nested mappings via indentation, and sequences (`- item`). Advanced YAML features like anchors, tags, flow collections, and multi-line scalars are not supported.
:::

Each accessible element in the tree is represented as a YAML node:

```yaml
- role "name" [attribute=value]
```

- `role`: The ARIA or implicit HTML role of the element, such as `heading`, `list`, `listitem`, or `button`
- `"name"`: The [accessible name](https://w3c.github.io/accname/), when present. Quoted strings match exact values, and `/patterns/` match regular expressions
- `[attribute=value]`: Accessibility states and properties such as `checked`, `disabled`, `expanded`, `level`, `pressed`, or `selected`

These values come from ARIA attributes and the browser's accessibility tree, including semantics inferred from native HTML elements.

Because ARIA snapshots reflect the browser's accessibility tree, content excluded from that tree, such as `aria-hidden="true"` or `display: none`, does not appear in the snapshot.

### Roles and Accessible Names

For example:

```html
<button>Submit</button>
<h1>Welcome</h1>
<a href="/">Home</a>
<input aria-label="Email" />
```

```yaml
- button "Submit"
- heading "Welcome" [level=1]
- link "Home"
- textbox "Email"
```

The role usually comes from the element's native semantics, though it can also be defined with ARIA. The accessible name is computed from text content, associated labels, `aria-label`, `aria-labelledby`, and related naming rules.

For a closer look at how names are computed, see [Accessible Name and Description Computation](https://w3c.github.io/accname/).

Some content appears in the snapshot as a text node instead of a role-based element:

```html
<span>Hello world</span>
```

```yaml
- text: Hello world
```

### Children

Child elements appear nested under their parent:

```html
<ul>
  <li>First</li>
  <li>Second</li>
  <li>Third</li>
</ul>
```

```yaml
- list:
    - listitem: First
    - listitem: Second
    - listitem: Third
```

If the parent has an accessible name, the snapshot includes it before the nested children:

```html
<nav aria-label="Main">
  <a href="/">Home</a>
  <a href="/about">About</a>
</nav>
```

```yaml
- navigation "Main":
    - link "Home"
    - link "About"
```

If an element only contains a single text child and has no other properties, the text is rendered inline:

```html
<p>Hello world</p>
```

```yaml
- paragraph: Hello world
```

### Attributes

ARIA states and properties appear in brackets:

| HTML                                                                   | Snapshot                                  |
| ---------------------------------------------------------------------- | ----------------------------------------- |
| `<input type="checkbox" checked aria-label="Agree">`                   | `- checkbox "Agree" [checked]`            |
| `<input type="checkbox" aria-checked="mixed" aria-label="Select all">` | `- checkbox "Select all" [checked=mixed]` |
| `<button aria-disabled="true">Submit</button>`                         | `- button "Submit" [disabled]`            |
| `<button aria-expanded="true">Menu</button>`                           | `- button "Menu" [expanded]`              |
| `<h2>Title</h2>`                                                       | `- heading "Title" [level=2]`             |
| `<button aria-pressed="true">Bold</button>`                            | `- button "Bold" [pressed]`               |
| `<button aria-pressed="mixed">Bold</button>`                           | `- button "Bold" [pressed=mixed]`         |
| `<option selected>English</option>`                                    | `- option "English" [selected]`           |

Attributes only appear when they are active. A button that is not disabled simply has no `[disabled]` attribute — there is no `[disabled=false]`.

### Pseudo-Attributes

Some DOM properties that aren't part of ARIA but are useful for testing are exposed with a `/` prefix:

#### `/url:`

Links include their URL:

```html
<a href="/">Home</a>
```

```yaml
- link "Home":
    - /url: /
```

#### `/placeholder:`

Textboxes can include their placeholder text:

```html
<input aria-label="Email" placeholder="user@example.com" />
```

```yaml
- textbox "Email":
    - /placeholder: user@example.com
```

::: tip When does `/placeholder:` appear?

The `/placeholder:` pseudo-attribute only appears when the placeholder text is **different from the accessible name**. When an input has a placeholder but no `aria-label` or associated `<label>`, the browser uses the placeholder as the accessible name. In that case, the placeholder information is already in the name and is not duplicated.

- When placeholder is the accessible name:

```html
<input placeholder="Search" />
```

```yaml
- textbox "Search"
```

- When placeholder differs from the accessible name:

```html
<input placeholder="Search" aria-label="Search products" />
```

```yaml
- textbox "Search products":
    - /placeholder: Search
```

:::

## Matching

### Regular Expressions

Use regex patterns to match names flexibly:

```html
<h1>Welcome, Alice</h1>
<a href="https://example.com/profile/123">Profile</a>
```

```yaml
- heading /Welcome, .*/
- link "Profile":
    - /url: /https:\/\/example\.com\/.*/
```

Regex also works in pseudo-attribute values:

```html
<input aria-label="Search" placeholder="Type to search..." />
```

```yaml
- textbox "Search":
    - /placeholder: /Type .*/
```

::: warning Escaping backslashes in regex patterns
Snapshots are stored as JavaScript strings — in backtick-delimited template literals for inline snapshots and in `.snap` files. Because of this, backslashes need to be **doubled** when you hand-edit a snapshot to add a regex pattern.

For example, to match one or more digits with `\d+`:

```ts
// ✅ Correct — double backslash
await expect.element(button).toMatchAriaInlineSnapshot(`
  - button: /item \\d+/
`)

// ❌ Wrong — single backslash is consumed by JS, regex sees "d+" instead of "\d+"
await expect.element(button).toMatchAriaInlineSnapshot(`
  - button: /item \d+/
`)
```

This applies to both inline snapshots and `.snap` files. When Vitest **auto-generates** or **updates** a snapshot, escaping is handled automatically — you only need to worry about this when hand-editing regex patterns.
:::

### Child Matching

The `/children` directive controls how a node's children are compared against the template. There are three modes:

#### Partial Matching (default)

By default (no `/children` directive), templates use **contain** semantics — extra children in the actual tree are allowed as long as all template children appear as an ordered subsequence. This is the same as `/children: contain`.

```html
<main>
  <h1>Welcome</h1>
  <p>Some intro text</p>
  <button>Get Started</button>
</main>
```

```ts
// This passes — the template children are a subset of the actual children
await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
  - main:
    - heading "Welcome" [level=1]
`)
```

This is useful for focused, resilient tests that don't break when unrelated content is added.

#### Exact Matching (`/children: equal`)

Requires that the node's immediate children match the template exactly — same count, same order. No extra children are allowed at this level.

```html
<ul aria-label="Features">
  <li>Feature A</li>
  <li>Feature B</li>
  <li>Feature C</li>
</ul>
```

```ts
// This FAILS — the list has 3 items but the template only lists 2
await expect.element(page.getByRole('list')).toMatchAriaInlineSnapshot(`
  - list "Features":
    - /children: equal
    - listitem: Feature A
    - listitem: Feature B
`)
```

```ts
// This PASSES — all 3 items are listed
await expect.element(page.getByRole('list')).toMatchAriaInlineSnapshot(`
  - list "Features":
    - /children: equal
    - listitem: Feature A
    - listitem: Feature B
    - listitem: Feature C
`)
```

The strict matching only applies at the level where `/children` is placed. Descendants of each `listitem` still use the default contain semantics.

#### Deep Exact Matching (`/children: deep-equal`)

Like `equal`, but the strict matching **propagates to all descendants**. Every level of nesting must match exactly — same count, same order, no extra nodes at any depth.

```ts
await expect.element(page.getByRole('navigation')).toMatchAriaInlineSnapshot(`
  - navigation "Main":
    - /children: deep-equal
    - link "Home":
      - /url: /
    - link "About":
      - /url: /about
`)
```

With `deep-equal`, every child of each `link` must also match exactly. If a link had an extra child node not listed in the template, the assertion would fail.

#### Comparison

| Mode | Directive | Behavior |
| --- | --- | --- |
| Partial | _(default)_ or `/children: contain` | Template children are an ordered subsequence — extra actual children are ignored |
| Exact | `/children: equal` | Immediate children must match exactly; descendants still use partial matching |
| Deep exact | `/children: deep-equal` | All children at every depth must match exactly |
