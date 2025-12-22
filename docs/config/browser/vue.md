# vitest-browser-vue

The community [`vitest-browser-vue`](https://www.npmjs.com/package/vitest-browser-vue) package renders Vue components in [Browser Mode](/guide/browser/).

```ts
import { render } from 'vitest-browser-vue'
import { expect, test } from 'vitest'

test('counter button increments the count', async () => {
  const screen = render(Component, {
    props: {
      initialCount: 1,
    }
  })

  await screen.getByRole('button', { name: 'Increment' }).click()

  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
```
