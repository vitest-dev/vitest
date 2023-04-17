# @vitest/snapshot

Lightweight implementation of Jest's snapshots.

## Usage

```js
import { SnapshotClient } from '@vitest/snapshot'
import { NodeSnapshotEnvironment } from '@vitest/snapshot/environment'
import { SnapshotManager } from '@vitest/snapshot/manager'

export class CustomSnapshotClient extends SnapshotClient {
  // by default, @vitest/snapshot checks equality with `!==`
  // you need to provide your own equality check implementation
  // this function is called when `.toMatchSnapshot({ property: 1 })` is called
  equalityCheck(received, expected) {
    return equals(received, expected, [iterableEquality, subsetEquality])
  }
}

const client = new CustomSnapshotClient()
// class that implements snapshot saving and reading
// by default uses fs module, but you can provide your own implementation depending on the environment
const environment = new NodeSnapshotEnvironment()

function getCurrentFilepath() {
  return '/file.spec.ts'
}
function getCurrentTestName() {
  return 'test1'
}

function wrapper(received) {
  function __INLINE_SNAPSHOT__(inlineSnapshot, message) {
    client.assert({
      received,
      message,
      isInline: true,
      inlineSnapshot,
      // you need to implement this yourselves,
      // this depends on your runner
      filepath: getCurrentFilepath(),
      name: getCurrentTestName(),
    })
  }
  return {
    // the name is hard-coded, it should be inside another function, so Vitest can find the actual test file where it was called (parses call stack trace + 2)
    // you can override this behaviour in SnapshotState's `_inferInlineSnapshotStack` method by providing your own SnapshotState to SnapshotClient constructor
    toMatchInlineSnapshot: (...args) => __INLINE_SNAPSHOT__(...args),
  }
}

const options = {
  updateSnapshot: 'new',
  snapshotEnvironment: environment,
}

await client.setTest(getCurrentFilepath(), getCurrentTestName(), options)

// uses "pretty-format", so it requires quotes
// also naming is hard-coded when parsing test files
wrapper('text 1').toMatchInlineSnapshot()
wrapper('text 2').toMatchInlineSnapshot('"text 2"')

const result = await client.resetCurrent() // this saves files and returns SnapshotResult

// you can use manager to manage several clients
const manager = new SnapshotManager(options)
manager.add(result)

// do something
// and then read the summary

console.log(manager.summary)
```