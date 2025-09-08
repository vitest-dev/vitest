# Mocking the File System

Mocking the file system ensures that the tests do not depend on the actual file system, making the tests more reliable and predictable. This isolation helps in avoiding side effects from previous tests. It allows for testing error conditions and edge cases that might be difficult or impossible to replicate with an actual file system, such as permission issues, disk full scenarios, or read/write errors.

Vitest doesn't provide any file system mocking API out of the box. You can use `vi.mock` to mock the `fs` module manually, but it's hard to maintain. Instead, we recommend using [`memfs`](https://www.npmjs.com/package/memfs) to do that for you. `memfs` creates an in-memory file system, which simulates file system operations without touching the actual disk. This approach is fast and safe, avoiding any potential side effects on the real file system.

## Example

To automatically redirect every `fs` call to `memfs`, you can create `__mocks__/fs.cjs` and `__mocks__/fs/promises.cjs` files at the root of your project:

::: code-group
```ts [__mocks__/fs.cjs]
// we can also use `import`, but then
// every export should be explicitly defined

const { fs } = require('memfs')
module.exports = fs
```

```ts [__mocks__/fs/promises.cjs]
// we can also use `import`, but then
// every export should be explicitly defined

const { fs } = require('memfs')
module.exports = fs.promises
```
:::

```ts [read-hello-world.js]
import { readFileSync } from 'node:fs'

export function readHelloWorld(path) {
  return readFileSync(path, 'utf-8')
}
```

```ts [hello-world.test.js]
import { beforeEach, expect, it, vi } from 'vitest'
import { fs, vol } from 'memfs'
import { readHelloWorld } from './read-hello-world.js'

// tell vitest to use fs mock from __mocks__ folder
// this can be done in a setup file if fs should always be mocked
vi.mock('node:fs')
vi.mock('node:fs/promises')

beforeEach(() => {
  // reset the state of in-memory fs
  vol.reset()
})

it('should return correct text', () => {
  const path = '/hello-world.txt'
  fs.writeFileSync(path, 'hello world')

  const text = readHelloWorld(path)
  expect(text).toBe('hello world')
})

it('can return a value multiple times', () => {
  // you can use vol.fromJSON to define several files
  vol.fromJSON(
    {
      './dir1/hw.txt': 'hello dir1',
      './dir2/hw.txt': 'hello dir2',
    },
    // default cwd
    '/tmp',
  )

  expect(readHelloWorld('/tmp/dir1/hw.txt')).toBe('hello dir1')
  expect(readHelloWorld('/tmp/dir2/hw.txt')).toBe('hello dir2')
})
```
