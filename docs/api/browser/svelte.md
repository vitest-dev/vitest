# vitest-browser-svelte

The community [`vitest-browser-svelte`](https://www.npmjs.com/package/vitest-browser-svelte) package renders Svelte components in [Browser Mode](/guide/browser/).

```ts
import { render } from 'vitest-browser-svelte'
import { expect, test } from 'vitest'
import Component from './Component.svelte'

test('counter button increments the count', async () => {
  const screen = render(Component, {
    initialCount: 1,
  })

  await screen.getByRole('button', { name: 'Increment' }).click()

  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
```
