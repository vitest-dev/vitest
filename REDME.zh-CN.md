<p align="center">
<img src="https://user-images.githubusercontent.com/11247099/145112184-a9ff6727-661c-439d-9ada-963124a281f7.png" height="200">
</p>

<h1 align="center">
Vitest
</h1>
<p align="center">
一个基于Vite快如闪电的单元测试框架
<p>
<p align="center">
  <a href="https://www.npmjs.com/package/vitest"><img src="https://img.shields.io/npm/v/vitest?color=a1b858&label="></a>
<p>
<h3 align="center">
<a href="https://chat.vitest.dev"><i>参与进来！</i></a>
</h3>
<br>
<br>

> Vitest 需要 Vite >=v2.7.10 和 Node >=v14

跟随 [入门指南](https://vitest.dev/guide/) 去了解 [我们为什么要构建新的测试框架](https://vitest.dev/guide/why).

## 文档

阅读[文档](https://vitest.dev/).

[事例](https://vitest.dev/guide/#examples) | [使用Vitest的项目](https://vitest.dev/guide/#projects-using-vitest)

## 特性

- 支持您使用[Vite](https://vitejs.dev/)应用中的配置！
- [Jest 友好](https://jestjs.io/docs/snapshot-testing)
- 内置[Chai](https://www.chaijs.com/)的断言, 兼容[Jest expect](https://jestjs.io/docs/expect) APIs
- 测试用例支持HMR，[智能 & 监听模式](https://vitest.dev/guide/features.html#watch-mode)!
- 通过[c8](https://github.com/bcoe/c8)输出[测试用例覆盖](https://vitest.dev/guide/features.html#coverage)  
- 内置[Tinyspy](https://github.com/Aslemammad/tinyspy)的模拟（mocking）、打桩（stubbing）、和窥探（spies）
- 用于模拟 DOM 和浏览器 API 的[JSDOM](https://github.com/jsdom/jsdom) 和[happy-dom](https://github.com/capricorn86/happy-dom)
- 组件测试 ([Vue](./examples/vue), [React](./examples/react), [Svelte](./examples/svelte), [Lit](./examples/lit), [Vitesse](./examples/vitesse))
- 通过[tinypool](https://github.com/Aslemammad/tinypool)支持多线程 ([Piscina](https://github.com/piscinajs/piscina)轻量级分支)
- ESM先行, 顶层await
- 开箱即用的 TypeScript / JSX
- 测试套件的过滤（Filtering）、超时（timeouts）、并发（concurrent）

```ts
import { assert, describe, expect, it } from 'vitest'

describe('suite name', () => {
  it('foo', () => {
    expect(1 + 1).toEqual(2)
    expect(true).to.be.true
  })

  it('bar', () => {
    assert.equal(Math.sqrt(4), 2)
  })

  it('snapshot', () => {
    expect({ foo: 'bar' }).toMatchSnapshot()
  })
})
```

```bash
$ npx vitest
```

## Sponsors

### Anthony Fu Sponsors

<p align="center">
  <a href="https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg">
    <img src='https://cdn.jsdelivr.net/gh/antfu/static/sponsors.svg'/>
  </a>
</p>

### Patak Sponsors

<p align="center">
  <a href="https://patak.dev/sponsors.svg">
    <img src='https://patak.dev/sponsors.svg'/>
  </a>
</p>

## Credits

Thanks to:

- [The Jest team and community](https://jestjs.io/) for creating a delightful testing API
- [@lukeed](https://github.com/lukeed) for the work on [uvu](https://github.com/lukeed/uvu) where we are inspired a lot from.
- [@pi0](https://github.com/pi0) for the idea and implementation of using Vite to transform and bundle the server code.
- [The Vite team](https://github.com/vitejs/vite) for brainstorming the initial idea.
- [@patak-dev](https://github.com/patak-dev) for the awesome package name!

## Contribution
See [Contributing Guide](https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md).

## License

[MIT](./LICENSE) License © 2021-Present [Anthony Fu](https://github.com/antfu), [Matias Capeletto](https://github.com/patak-dev)
