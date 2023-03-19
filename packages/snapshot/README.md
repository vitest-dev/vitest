# @vitest/snapshot

Lightweight implementation of Jest's snapshots.

## Usage

```ts
import { SnapshotClient } from '@vitest/snapshot'
import { NodeSnapshotEnvironment } from '@vitest/snapshot/environment'
import { SnapshotManager } from '@vitest/snapshot/manager'

export class CustomSnapshotClient extends SnapshotClient {
  // by default, @vitest/snapshot checks equality with `!==`
  // you need to provide your own equality check implementation
  // this function is called when `.toMatchSnapshot({ property: 1 })` is called
  equalityCheck(received: unknown, expected: unknown): boolean {
    return equals(received, expected, [iterableEquality, subsetEquality])
  }
}

const client = new CustomSnapshotClient()
// class that implements snapshot saving and reading
// by default uses fs module, but you can provide your own implementation depending on the environment
const environment = new NodeSnapshotEnvironment()

const getCurrentFilepath = () => '/'
const getCurrentTestName = () => 'test1'

const wrapper = (received: unknown) => {
  // the name is important. it should be inside another function, so Vitest can find the actual test file where it was called
  // you can override this behaviour in SnapshotState's `_inferInlineSnapshotStack` method by providing your own SnapshotState to SnapshotClient constructor
  function __INLINE_SNAPSHOT__(inlineSnapshot?: string, message?: string) {
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
    toMatchInlineSnapshot: __INLINE_SNAPSHOT__,
  }
}

const options = {
  updateSnapshot: 'none',
  snapshotEnvironment: environment,
}

await client.setTest(getCurrentFilepath(), getCurrentTestName(), options)

wrapper('text 1').toMatchInlineSnapshot('text 1')
wrapper('text 2').toMatchInlineSnapshot('text 2')

const result = await client.resetCurrent() // returns SnapshotResult

// you can use manager to manage several clients
const manager = new SnapshotManager(options)
manager.add(result)

// do something
// and then read the summary

manager.summary
```