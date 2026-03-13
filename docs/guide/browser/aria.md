---
title: ARIA Snapshots | Guide
outline: deep
---

# ARIA Snapshots

ARIA snapshots let you test the accessibility structure of your pages. Instead of asserting against raw HTML or visual output, you assert against the accessibility tree — the same structure that screen readers and other assistive technologies use.

Given this HTML:

```html
<body>
  <h1>Welcome</h1>
  <nav>
    <a href="/">Home</a>
    <a href="/about">About</a>
  </nav>
</body>
```

You can assert its accessibility tree:

```ts
await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
  - heading "Welcome" [level=1]
  - navigation:
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
<body>
  <h1>Log In</h1>
  <input aria-label="Email" />
  <input aria-label="Password" type="password" />
  <button>Submit</button>
</body>
```

### File Snapshots

Use `toMatchAriaSnapshot()` to store the snapshot in a `.snap` file alongside your test:

```ts
import { expect, test } from 'vitest'

test('login form', async () => {
  await expect.element(page.getByRole('main')).toMatchAriaSnapshot()
})
```

On first run, Vitest generates a snapshot file entry:

```yaml
- heading "Log In" [level=1]
- textbox "Email"
- textbox "Password"
- button "Submit"
```

### Inline Snapshots

Use `toMatchAriaInlineSnapshot()` to store the snapshot directly in the test file:

```ts
import { expect, test } from 'vitest'

test('login form', async () => {
  await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
    - heading "Log In" [level=1]
    - textbox "Email"
    - textbox "Password"
    - button "Submit"
  `)
})
```

## Browser Mode Retry Behavior

In [Browser Mode](/guide/browser/), `expect.element()` automatically retries ARIA snapshot assertions until the accessibility tree matches or the timeout is reached:

```ts
await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
  - heading "Log In" [level=1]
  - textbox "Email"
  - textbox "Password"
  - button "Submit"
`)
```

The matcher re-queries the element and re-captures the accessibility tree on each attempt.

Retry only applies when comparing against an existing snapshot. On first run, or when using `--update`, the matcher captures once and writes immediately.

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

::: warning Merge limitations
The merge works by matching nodes in order. If a literal mismatch appears _before_ a regex node, the merge may fall back to a full update and lose subsequent regex patterns. To avoid this, place regex patterns on nodes that are likely to change, and keep stable literal nodes before them.
:::

## Snapshot Format

ARIA snapshots use a YAML-like syntax. Each line represents a node in the accessibility tree.

Each accessible element in the tree is represented as a YAML node:

```yaml
- role "name" [attribute=value]
```

- `role`: The ARIA or implicit HTML role of the element, such as `heading`, `list`, `listitem`, or `button`
- `"name"`: The [accessible name](https://w3c.github.io/accname/), when present. Quoted strings match exact values, and `/patterns/` match regular expressions
- `[attribute=value]`: Accessibility states and properties such as `checked`, `disabled`, `expanded`, `level`, `pressed`, or `selected`

These values come from ARIA attributes and the browser's accessibility tree, including semantics inferred from native HTML elements.

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

### Partial Matching

Templates match partially by default — you don't need to list every node. Only the nodes you include are checked:

```html
<body>
  <h1>Welcome</h1>
  <p>Some intro text</p>
  <button>Get Started</button>
</body>
```

```ts
// This passes even if the page has other elements
await expect.element(page.getByRole('main')).toMatchAriaInlineSnapshot(`
  - heading "Welcome" [level=1]
`)
```

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

## Accessible Names

The accessible name of an element is determined by a set of rules from the [ARIA specification](https://w3c.github.io/accname/). Understanding the basics helps you write better snapshots.

### Text Content

By default, an element's name comes from its text content:

```html
<button>Submit</button>
```

```yaml
- button "Submit"
```

### `aria-label`

`aria-label` overrides the text content as the accessible name:

```html
<button aria-label="Close">X</button>
```

```yaml
- button "Close": X
```

Note that "X" still appears as a text child, but the name is "Close".

### `aria-labelledby`

`aria-labelledby` references another element by ID:

```html
<h2 id="section-title">Settings</h2>
<form aria-labelledby="section-title">...</form>
```

```yaml
- heading "Settings" [level=2]
- form "Settings": ...
```

### Placeholder as Name

When an input has no label, the placeholder serves as the accessible name:

```html
<input placeholder="Search" />
```

```yaml
- textbox "Search"
```

## Common HTML-to-Role Mappings

| HTML              | ARIA Role    | Notes                            |
| ----------------- | ------------ | -------------------------------- |
| `<h1>` ... `<h6>` | `heading`    | Includes `[level=N]`             |
| `<button>`        | `button`     |                                  |
| `<a href="...">`  | `link`       | `<a>` without `href` has no role |
| `<input>`         | `textbox`    | For text-like inputs             |
| `<select>`        | `combobox`   |                                  |
| `<ul>`, `<ol>`    | `list`       |                                  |
| `<li>`            | `listitem`   |                                  |
| `<table>`         | `table`      |                                  |
| `<tr>`            | `row`        |                                  |
| `<td>`            | `cell`       |                                  |
| `<nav>`           | `navigation` |                                  |
| `<main>`          | `main`       |                                  |
| `<p>`             | `paragraph`  |                                  |
| `<img alt="...">` | `img`        |                                  |

An explicit `role="..."` attribute overrides the implicit role:

```html
<div role="alert">Warning!</div>
```

```yaml
- alert: Warning!
```

## What Gets Excluded

The following elements are excluded from the ARIA snapshot, matching how assistive technologies handle them:

- **`aria-hidden="true"`** — explicitly hidden from the accessibility tree
- **`display: none`** — not rendered at all
- **`visibility: hidden`** — rendered but invisible
- **`role="presentation"` / `role="none"`** — semantics explicitly removed

```html
<div aria-hidden="true">Hidden from AT</div>
<p>Visible to AT</p>
```

```yaml
- paragraph: Visible to AT
```

## Pseudo-Elements

CSS `::before` and `::after` pseudo-elements contribute to both the accessible name and the text content in the tree:

```html
<style>
  .required::after {
    content: ' *';
  }
</style>
<label class="required">Name</label>
```

The generated content "` *`" is included in the accessible name computation, just as assistive technologies would encounter it.
