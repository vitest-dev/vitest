# vitest-browser-react

The community [`vitest-browser-react`](https://www.npmjs.com/package/vitest-browser-react) package renders React components in [Browser Mode](/guide/browser/).

```tsx
import { render } from 'vitest-browser-react'
import { expect, test } from 'vitest'

test('counter button increments the count', async () => {
  const screen = await render(<Component count={1} />)

  await screen.getByRole('button', { name: 'Increment' }).click()

  await expect.element(screen.getByText('Count is 2')).toBeVisible()
})
```
