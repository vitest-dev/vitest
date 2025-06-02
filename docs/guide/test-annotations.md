---
title: Test Annotations | Guide
outline: deep
---

# Test Annotations

Vitest supports annotating your tests with custom messages and files via the [`context.annotate`](/guide/test-context#annotate) API. These annotations will be attached to the test case and passed down to reporters in the [`onTestAnnotate`](/advanced/api/reporters#ontestannotate) hook.

```ts
test('hello world', async ({ annotate }) => {
  await annotate('this is my test')

  if (condition) {
    await annotate('this should\'ve errored', 'error')
  }

  const file = createTestSpecificFile()
  await annotate('creates a file', { body: file })
})
```

::: warning
The `annotate` function returns a Promise, so it needs to be awaited if you rely on it somehow. However, Vitest will also automatically await any non-awaited annotation before the test finishes.
:::

Depending on your reporter, you will see these annotations differently.

## Built-in Reporters
### default

The `default` reporter prints annotations only if the test has failed:

```
  ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

  FAIL  example.test.js > an example of a test with annotation
Error: thrown error
  ❯ example.test.js:11:21
      9 |    await annotate('annotation 1')
      10|    await annotate('annotation 2', 'warning')
      11|    throw new Error('thrown error')
        |          ^
      12|  })

  ❯ example.test.js:9:15 notice
    ↳ annotation 1
  ❯ example.test.js:10:15 warning
    ↳ annotation 2

  ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯
```

### verbose

In a TTY terminal, the `verbose` reporter works similarly to the `default` reporter. However, in a non-TTY environment, the `verbose` reporter will also print annotations after every test.

```
✓ example.test.js > an example of a test with annotation

  ❯ example.test.js:9:15 notice
    ↳ annotation 1
  ❯ example.test.js:10:15 warning
    ↳ annotation 2

```

### html

The HTML reporter shows annotations the same way the UI does. You can see the annotation on the line where it was called. At the moment, if the annotation wasn't called in a test file, you cannot see it in the UI. We are planning to support a separate test summary view where it will be visible.

<img alt="Vitest UI" img-light src="/annotations-html-light.png">
<img alt="Vitest UI" img-dark src="/annotations-html-dark.png">

### junit

The `junit` reporter lists annotations inside the testcase's `properties` tag. The JUnit reporter will ignore all attachments and will print only the type and the message.

```xml
<testcase classname="basic/example.test.js" name="an example of a test with annotation" time="0.14315">
    <properties>
        <property name="notice" value="the message of the annotation">
        </property>
    </properties>
</testcase>
```

### github-actions

The `github-actions` reporter will print the annotation as a [notice message](https://docs.github.com/en/actions/writing-workflows/choosing-what-your-workflow-does/workflow-commands-for-github-actions#setting-a-notice-message) by default. You can configure the `type` by passing down the second argument as `notice`, `warning` or `error`. If type is none of these, Vitest will show the message as a notice.

<img alt="GitHub Actions" img-light src="/annotations-gha-light.png">
<img alt="GitHub Actions" img-dark src="/annotations-gha-dark.png">

### tap

The `tap` and `tap-flat` reporters print annotations as diagnostic messages on a new line starting with a `#` symbol. They will ignore all attachments and will print only the type and message:

```
ok 1 - an example of a test with annotation # time=143.15ms
    # notice: the message of the annotation
```
