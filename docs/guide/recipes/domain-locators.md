---
title: Domain Locators | Recipes
---

# Domain Locators

Built-in [locators](/api/browser/locators) like `getByRole` and `getByText` cover queries that map onto accessibility attributes. They run out when an app has shapes that don't fit ARIA, like a "comment with N replies" or a row in a custom table component.

The fallback is to use raw CSS. That works, but the result is a plain query rather than a locator, so you lose auto-retry and strict-mode protection.

[`locators.extend`](/api/browser/locators#custom-locators) <Version>3.2.0</Version> adds a domain-specific locator without giving up the locator API. The value the method returns is still a locator, so auto-retry, strict-mode protection, and chaining all carry through to your custom methods. The names you give those methods become part of the team's test vocabulary: `page.getByCard({ id: 'product-1' })` reads like the product instead of the DOM, and the same name shows up consistently across the suite.

## Returning a Playwright string

The simplest form returns a [Playwright locator string](https://playwright.dev/docs/other-locators). Vitest treats the returned string as a child query of whatever locator the method was called on: when called on `page`, the string runs against the entire page; when called on a parent locator, it runs scoped to that parent's subtree.

Reach for this form when the new query has no good expression in built-in locators, like a CSS-with-text selector for a widget that doesn't map onto a built-in role, or an XPath for a legacy component you don't control.

```ts
import { locators } from 'vitest/browser'

locators.extend({
  getByCommentsCount(count: number) {
    return `.comments :text("${count} comments")`
  },
})
```

```ts
import { expect, test } from 'vitest'
import { page } from 'vitest/browser'

test('article shows comment count', async () => {
  await expect.element(page.getByCommentsCount(1)).toBeVisible()
  await expect.element(
    page.getByRole('article', { name: 'Hello World' })
      .getByCommentsCount(1)
  ).toBeVisible()
})
```

## Composing existing locators

When you return a locator instead of a string, Vitest uses that locator directly. Inside the extension, `this` is bound to the locator the method was called on (or to `page` for top-level calls), so you can chain existing locators or apply `filter` to express relationships between elements that no single built-in option captures.

The example below uses `filter({ has })` to narrow a row locator to those that contain a button with a given name, encoding a common per-row-actions pattern as a single named lookup:

```ts
import { locators } from 'vitest/browser'
import type { Locator } from 'vitest/browser'

locators.extend({
  getRowWithAction(this: Locator, action: string) {
    return this.getByRole('row').filter({
      has: this.getByRole('button', { name: action }),
    })
  },
})
```

```ts
await page.getRowWithAction('Delete').first().click()
```

Prefer this over the raw-string form when both options can express the query. Built-in locators encode accessibility-aware lookups, and chaining or filtering them preserves those guarantees. Reach for the raw-string form only when no chain of built-ins covers the query, since the string runs whatever selector you wrote and bypasses the locator mechanism you're trying to keep.

## Custom interactions

Methods that perform an interaction instead of returning a locator also work. This is the same mechanism used for shaping your own DSL of user actions, defined alongside your queries so the test vocabulary stays consistent.

`locators.extend` types `this` as `BrowserPage | Locator`, since custom methods are reachable from both. For query helpers that's fine, since `getByRole` and other query methods exist on both. For interaction helpers it isn't: `page` has no `click` or `fill`, so calling `page.clickAndFill('x')` would fail at runtime. Guard against that by comparing `this` against the `page` singleton, which lets TypeScript narrow `this` to `Locator` after the throw:

```ts
import { locators, page } from 'vitest/browser'
import type { BrowserPage, Locator } from 'vitest/browser'

locators.extend({
  async clickAndFill(this: BrowserPage | Locator, text: string) {
    if (this === page) {
      throw new TypeError(
        'clickAndFill must be called on a locator, like page.getByRole(\'textbox\').clickAndFill(...)',
      )
    }
    await this.click()
    await this.fill(text)
  },
})

await page.getByRole('textbox').clickAndFill('Hello World')
```

Interaction methods don't compose into selectors. `page.getByRole('textbox').clickAndFill('Hello')` works because `getByRole` returns a locator; `page.clickAndFill('Hello')` would hit the guard. Reach for this form for action helpers, not for query helpers.

## Augmenting locator types

`locators.extend` is a runtime registration. TypeScript doesn't know about the new methods until you augment the [`LocatorSelectors`](/api/browser/locators) interface, usually in a shared `.d.ts` file:

```ts
import 'vitest/browser'

declare module 'vitest/browser' {
  interface LocatorSelectors {
    getByCommentsCount: (count: number) => Locator
    getRowWithAction: (action: string) => Locator
    clickAndFill: (text: string) => Promise<void>
  }
}
```

`LocatorSelectors` is the interface that both `Locator` and `BrowserPage` extend, so any method declared on it shows up on both. That matches what `locators.extend` does at runtime, and it's why interaction helpers like `clickAndFill` need the guard above: TypeScript will let `page.clickAndFill('x')` type-check, but the guard catches the misuse before it hits a missing method.

## See also

- [Custom Locators API](/api/browser/locators#custom-locators)
- [Built-in Locators](/api/browser/locators)
- [Playwright "other locators"](https://playwright.dev/docs/other-locators)
