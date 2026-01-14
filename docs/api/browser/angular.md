---
outline: deep
---

# vitest-browser-angular

The community [`vitest-browser-angular`](https://www.npmjs.com/package/vitest-browser-angular) package renders [Angular](https://angular.dev/) components in [Browser Mode](/guide/browser/).

```ts
import { Component, input } from '@angular/core'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-angular'

@Component({
  selector: 'app-hello-world',
  template: '<h1>Hello, {{ name() }}!</h1>',
})
export class HelloWorldComponent {
  name = input.required<string>()
}

test('renders name', async () => {
  const { component } = await render(HelloWorldComponent, {
    inputs: {
      name: 'World',
    },
  })

  await expect.element(component).toHaveTextContent('Hello, World!')
})
```

::: tip
`vitest-browser-angular` returns APIs that interact well with built-in [locators](/api/browser/locators), [user events](/api/browser/interactivity) and [assertions](/api/browser/assertions): for example, Vitest will automatically retry the element until the assertion is successful, even if it was rerendered between the assertions.
:::

The package exposes two entry points: `vitest-browser-angular` and `vitest-browser-angular/pure`. They expose identical API, but the `pure` entry point doesn't add a handler to remove the component before the next test has started.

## Setup

Before using `vitest-browser-angular`, you need to set up the test environment using `@analogjs/vitest-angular`:

::: code-group
```ts [zoneless]
import '@angular/compiler'
import '@analogjs/vitest-angular/setup-snapshots'
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed'

setupTestBed({ browserMode: true })
```
```ts [zone&period;js setup]
import '@angular/compiler'
import '@analogjs/vitest-angular/setup-zone'
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed'

setupTestBed({ browserMode: true, zoneless: false })
```
:::

Then reference this setup file in your Vitest configuration:

```ts [vitest.config.ts]
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

For detailed setup instructions for both Zone.js and Zoneless configurations, please refer to the [Analog Vitest documentation](https://analogjs.org/docs/features/testing/vitest).

## render

```ts
export function render<T>(
  componentClass: Type<T>,
  config?: RenderConfig<T>,
): Promise<RenderResult<T>>
```

::: warning
Note that `render` is asynchronous. This is to support Angular's change detection and initialization correctly.

```ts
import { render } from 'vitest-browser-angular'
const screen = render(Component) // [!code --]
const screen = await render(Component) // [!code ++]
```
:::

### Options

#### inputs

Pass values to component inputs. Works with both signal-based inputs (`input()`) and `@Input()` decorators.

```ts
@Component({
  selector: 'app-product',
  template: `
    <h1>{{ name() }}</h1>
    <p>Price: {{ price() }}</p>
  `,
})
export class ProductComponent {
  name = input.required<string>()
  price = input<number>(0)
}

const { component } = await render(ProductComponent, {
  inputs: {
    name: 'Laptop',
    price: 1299.99,
  },
})
```

#### providers

An array of providers to add to the test module. Use this for global services or dependencies.

```ts
const { component } = await render(UserComponent, {
  providers: [
    { provide: UserService, useValue: mockUserService },
  ],
})
```

#### componentProviders

An array of providers to add at the component level. Use this to override or add providers specific to the component being tested.

```ts
const { component } = await render(DataComponent, {
  componentProviders: [
    { provide: DataService, useClass: MockDataService },
  ],
})
```

#### imports

Additional modules or standalone components to import into the test module.

```ts
const { component } = await render(FormComponent, {
  imports: [ReactiveFormsModule, CommonModule],
})
```

#### withRouting

Enable routing features for components that use the Angular Router. Can be a boolean for basic setup or a configuration object for specific routes.

**Simple routing:**

```ts
const { component, router } = await render(NavComponent, {
  withRouting: true,
})
```

**With route configuration:**

```ts
import { Routes } from '@angular/router'

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'about', component: AboutComponent },
]

const { component, router, routerHarness } = await render(AppComponent, {
  withRouting: {
    routes,
    initialRoute: '/about',
  },
})
```

### component

A [locator](/api/browser/locators) pointing to the rendered component element. Use this for DOM queries and assertions.

```ts
const { component } = await render(HelloWorldComponent, {
  inputs: { name: 'World' },
})

await expect.element(component).toHaveTextContent('Hello, World!')
await component.getByRole('button').click()
```

### componentClassInstance

The actual Angular component class instance. Use this to access component methods and properties directly.

```ts
const { componentClassInstance } = await render(CounterComponent)

// Access component properties
expect(componentClassInstance.count()).toBe(0)

// Call component methods
componentClassInstance.increment()
```

### fixture

The Angular `ComponentFixture` for the rendered component. Provides access to Angular testing utilities.

```ts
const { fixture } = await render(MyComponent)

// Trigger change detection manually if needed
fixture.detectChanges()

// Access the native element
const nativeElement = fixture.nativeElement
```

### router

The Angular `Router` instance. Only available when `withRouting` is enabled.

```ts
const { router } = await render(AppComponent, {
  withRouting: true,
})

// Navigate programmatically
await router.navigate(['/about'])
```

### routerHarness

The `RouterTestingHarness` for testing routing scenarios. Only available when `withRouting` is enabled.

```ts
const { routerHarness } = await render(AppComponent, {
  withRouting: {
    routes,
    initialRoute: '/',
  },
})

// Navigate using the harness
await routerHarness.navigateByUrl('/about')
```

## cleanup

```ts
export function cleanup(): void
```

Remove all components rendered with [`render`](#render).

## Extend Queries

To extend locator queries, see [`"Custom Locators"`](/api/browser/locators#custom-locators). For example, to make `render` return a new custom locator, define it using the `locators.extend` API:

```ts {5-7,12}
import { locators } from 'vitest/browser'
import { render } from 'vitest-browser-angular'

locators.extend({
  getByArticleTitle(title) {
    return `[data-title="${title}"]`
  },
})

const screen = await render(Component)
await expect.element(
  screen.getByArticleTitle('Hello World')
).toBeVisible()
```

## Example: Testing a Form Component

```ts
import { Component, output } from '@angular/core'
import { FormsModule } from '@angular/forms'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-angular'

@Component({
  selector: 'app-login-form',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="onSubmit()">
      <input
        type="email"
        [(ngModel)]="email"
        name="email"
        placeholder="Email"
      />
      <input
        type="password"
        [(ngModel)]="password"
        name="password"
        placeholder="Password"
      />
      <button type="submit">Login</button>
    </form>
  `,
})
export class LoginFormComponent {
  email = ''
  password = ''
  submitted = output<{ email: string; password: string }>()

  onSubmit() {
    this.submitted.emit({ email: this.email, password: this.password })
  }
}

test('submits login form with credentials', async () => {
  const { component } = await render(LoginFormComponent)

  await component.getByPlaceholder('Email').fill('user@example.com')
  await component.getByPlaceholder('Password').fill('password123')
  await component.getByRole('button', { name: 'Login' }).click()

  // Assert form values were updated
  await expect.element(component.getByPlaceholder('Email')).toHaveValue('user@example.com')
})
```

## Example: Testing with Routing

```ts
import { Component } from '@angular/core'
import { RouterLink, RouterOutlet, Routes } from '@angular/router'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-angular'

@Component({
  selector: 'app-home',
  template: '<h1>Home</h1>',
})
export class HomeComponent {}

@Component({
  selector: 'app-about',
  template: '<h1>About</h1>',
})
export class AboutComponent {}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <nav>
      <a routerLink="/">Home</a>
      <a routerLink="/about">About</a>
    </nav>
    <router-outlet />
  `,
})
export class AppComponent {}

const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'about', component: AboutComponent },
]

test('navigates between routes', async () => {
  const { component, router } = await render(AppComponent, {
    withRouting: {
      routes,
      initialRoute: '/',
    },
  })

  await expect.element(component.getByText('Home')).toBeVisible()

  await component.getByRole('link', { name: 'About' }).click()

  await expect.element(component.getByText('About')).toBeVisible()
})
```

## See also

- [Angular Testing documentation](https://angular.dev/guide/testing)
- [Analog Vitest Angular](https://analogjs.org/docs/features/testing/vitest)
