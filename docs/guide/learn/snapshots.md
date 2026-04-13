---
title: Snapshot Testing | Guide
prev:
  text: Mock Functions
  link: /guide/learn/mock-functions
next:
  text: Testing in Practice
  link: /guide/learn/testing-in-practice
---

# Snapshot Testing

Snapshot tests capture the output of a piece of code and save it to a file. On subsequent runs, the output is compared against the saved snapshot. If the output changes, the test fails. Either the change is a bug, or the snapshot needs to be updated.

This approach is particularly useful when you're testing something that produces structured output: a function that returns a complex object, a component that renders HTML, or an error formatter that produces multi-line messages. Writing manual assertions for every field or line would be tedious and fragile. Instead, you capture the entire output once, and let Vitest tell you if it ever changes.

## Your First Snapshot

To create a snapshot test, pass a value to [`toMatchSnapshot()`](/api/expect#tomatchsnapshot):

```js
import { expect, test } from 'vitest'

function generateGreeting(name) {
  return {
    message: `Hello, ${name}!`,
    timestamp: null,
    version: 2,
  }
}

test('generates a greeting', () => {
  expect(generateGreeting('Alice')).toMatchSnapshot()
})
```

The first time you run this test, there's no existing snapshot to compare against, so Vitest creates one. It stores the snapshot in a `__snapshots__` directory next to your test file:

```
__snapshots__/
  example.test.js.snap
```

If you open that file, you'll see a serialized representation of the value:

```js
exports['generates a greeting 1'] = `
{
  "message": "Hello, Alice!",
  "timestamp": null,
  "version": 2,
}
`
```

From now on, every time you run this test, Vitest serializes the output of `generateGreeting('Alice')` and compares it character-by-character against this stored snapshot. If the output changes (say, someone modifies the message format or bumps the version number), the test fails and shows a clear diff of what changed.

::: tip
Commit your snapshot files to version control. They serve as a record of the expected output and should be reviewed in code review just like any other test assertion.
:::

## Inline Snapshots

External snapshot files work well, but they mean you have to jump to a different file to see what the expected output actually looks like. For smaller values, it's often more convenient to keep the snapshot right in your test file with [`toMatchInlineSnapshot()`](/api/expect#tomatchinlinesnapshot).

Start by writing the assertion without any argument:

```js
test('generates a greeting', () => {
  expect(generateGreeting('Alice')).toMatchInlineSnapshot()
})
```

When you run the test, Vitest will **automatically fill in** the snapshot as a string argument:

```js
test('generates a greeting', () => {
  expect(generateGreeting('Alice')).toMatchInlineSnapshot(`
    {
      "message": "Hello, Alice!",
      "timestamp": null,
      "version": 2,
    }
  `)
})
```

Now the expected output lives right next to the code that produces it. You can read the test and immediately understand what `generateGreeting` is expected to return. When the output changes, Vitest updates the string in place, so you don't need to manage separate snapshot files.

Inline snapshots are great for small, focused values. For large outputs (like a full HTML page), external snapshots or file snapshots are a better fit.

::: tip
Unlike external snapshots, inline snapshots don't create separate `.snap` files. The expected value is stored directly in your test file as the argument to `toMatchInlineSnapshot()`, so there's nothing extra to commit.
:::

## Updating Snapshots

When you intentionally change the output of your code, existing snapshots will be outdated and the tests will fail. This is by design; it's the whole point of snapshot testing. But once you've verified that the new output is correct, you need to update the snapshots.

There are several ways to do this:

- **In watch mode**: press `u` in the terminal to update all failed snapshots
- **From the CLI**: run `vitest -u` or `vitest --update` to update snapshots and exit
- **In VS Code**: use the "Update Snapshots" command on the test gutter icon from the [Vitest extension](https://vitest.dev/vscode)

```bash
vitest -u
```

For inline snapshots, Vitest modifies your test file directly with the new values. For external snapshots, it rewrites the `.snap` file.

::: warning
Be careful when updating snapshots. Always review the diff to confirm the changes are intentional and not a bug. It's easy to accidentally accept a broken output by blindly pressing `u`.
:::

## File Snapshots

Sometimes the output you're testing is large enough that even an external `.snap` file feels awkward, or you want to view the snapshot with proper syntax highlighting in your editor. [`toMatchFileSnapshot()`](/api/expect#tomatchfilesnapshot) lets you save the snapshot to a file with any extension you want:

```js
test('renders the component', async () => {
  const html = renderComponent()
  await expect(html).toMatchFileSnapshot('./fixtures/component.html')
})
```

The snapshot is stored as a plain `.html` file that you can open in a browser, view with syntax highlighting, or diff with standard tools. This works well for HTML, SVG, CSS, generated code, or any output where the file format matters for readability.

## When to Use Snapshots

Snapshots shine when you're working with structured, serializable output that would be painful to assert on manually. Some common use cases:

- A function that returns a complex configuration object with many nested fields
- HTML or markup generated by a rendering function or template engine
- Error messages that include formatted stack traces or context information
- CLI output or log messages with specific formatting
- JSON API responses where you want to catch any unexpected field changes

On the other hand, snapshots are not always the best tool. If the output changes frequently (for instance, it includes timestamps or random IDs), you'll spend more time updating snapshots than they save you. And if you only care about one or two specific fields, a targeted assertion like [`toMatchObject`](/api/expect#tomatchobject) or [`toHaveProperty`](/api/expect#tohaveproperty) expresses your intent more clearly than a snapshot that captures everything.

The general rule: use snapshots when you want to protect against *any* change in the output, and use targeted assertions when you only care about *specific* properties.

::: tip
For custom snapshot serializers, snapshot matchers, and advanced configuration, see the [Snapshot](/guide/snapshot) guide.
:::
