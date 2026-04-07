# Mocking Globals

You can mock global variables that are not present with `jsdom` or `node` by using [`vi.stubGlobal`](/api/vi#vi-stubglobal) helper. It will put the value of the global variable into a `globalThis` object.

By default, Vitest does not reset these globals, but you can turn on the [`unstubGlobals`](/config/unstubglobals) option in your config to restore the original values after each test or call [`vi.unstubAllGlobals()`](/api/vi#vi-unstuballglobals) manually.

```ts
import { vi } from 'vitest'

const IntersectionObserverMock = vi.fn(class {
  disconnect = vi.fn()
  observe = vi.fn()
  takeRecords = vi.fn()
  unobserve = vi.fn()
})

vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)

// now you can access it as `IntersectionObserver` or `window.IntersectionObserver`
```
