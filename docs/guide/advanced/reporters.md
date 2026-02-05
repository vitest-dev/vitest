# Extending Reporters <Badge type="danger">advanced</Badge> {#extending-reporters}

::: warning
This is an advanced API. If you just want to configure built-in reporters, read the ["Reporters"](/guide/reporters) guide.
:::

You can import reporters from `vitest/node` and extend them to create your custom reporters.

## Extending Built-in Reporters

In general, you don't need to create your reporter from scratch. `vitest` comes with several default reporting programs that you can extend.

```ts
import { DefaultReporter } from 'vitest/node'

export default class MyDefaultReporter extends DefaultReporter {
  // do something
}
```

::: warning
However, note that exposed reports are not considered stable and can change the shape of their API within a minor version.
:::

Of course, you can create your reporter from scratch. Just implement the [`Reporter`](/api/advanced/reporters) interface:

And here is an example of a custom reporter:

```ts [custom-reporter.js]
import type { Reporter } from 'vitest/node'

export default class CustomReporter implements Reporter {
  onTestModuleCollected(testModule) {
    console.log(testModule.moduleId, 'is finished')

    for (const test of testModule.children.allTests()) {
      console.log(test.name, test.result().state)
    }
  }
}
```

Then you can use your custom reporter in the `vitest.config.ts` file:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'
import CustomReporter from './custom-reporter.js'

export default defineConfig({
  test: {
    reporters: [new CustomReporter()],
  },
})
```

## Reported Tasks

Reported [events](/api/advanced/reporters) receive tasks for [tests](/api/advanced/test-case), [suites](/api/advanced/test-suite) and [modules](/api/advanced/test-module):

```ts twoslash
import type { Reporter, TestModule } from 'vitest/node'

class MyReporter implements Reporter {
  onTestRunEnd(testModules: ReadonlyArray<TestModule>) {
    for (const testModule of testModules) {
      for (const task of testModule.children) {
        //                          ^?
        console.log('test run end', task.type, task.fullName)
      }
    }
  }
}
```

## Exported Reporters

`vitest` comes with a few [built-in reporters](/guide/reporters) that you can use out of the box.

### Built-in reporters:

1. `DefaultReporter`
2. `DotReporter`
3. `JsonReporter`
4. `VerboseReporter`
5. `TapReporter`
6. `JUnitReporter`
7. `TapFlatReporter`
8. `HangingProcessReporter`
9. `TreeReporter`

### Interface reporters:

1. `Reporter`
