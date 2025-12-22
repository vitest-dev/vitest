# vitest-browser-angular

The community [`vitest-browser-angular`](https://www.npmjs.com/package/vitest-browser-angular) package renders Angular components in [Browser Mode](/guide/browser/).

```ts
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-angular'

@Component({
  template: '<h1>{{ title }}</h1>',
})
export class HelloWorldComponent {
  title = 'Hello World'
}

test('render', async () => {
  const { component } = await render(HelloWorldComponent)
  await expect.element(component).toHaveTextContent('Hello World')
})
```
