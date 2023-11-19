# @vitest/browser

Browser runner for Vitest.

> ⚠️ This package is **experimental**. While this package will be released along with other packages, it will not follow SemVer for breaking changes until we mark it as ready.

## Progress

Current Status: **Working in progress**

- [x] Init package and integration
- [x] Stub node packages for Vitest runtime
- [x] Works in development mode
- [x] Better log in terminal
- [x] Fulfill tests (using Browser only APIs, Vue and React components)
- [ ] Show progress and error on the browser page
- [x] Headless mode in CI
- [x] Docs

Related PRs

- [#1302](https://github.com/vitest-dev/vitest/pull/1302)

## Development Setup

At project root:

```bash
pnpm dev

cd test/browser
pnpm vitest --browser
```
