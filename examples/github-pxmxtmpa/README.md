https://github.com/vitest-dev/vitest/issues/9257

```sh
$ pnpm test run

> template-vitest@0.0.0 test /home/hiroshi/code/personal/reproductions/vitest-9257-mock-bad-dep
> vitest run

 RUN  v4.1.0-beta.3 /home/hiroshi/code/personal/reproductions/vitest-9257-mock-bad-dep

 ❯ src/mock-wrapper-and-bad-dep.test.ts (0 test)
 ❯ src/mock-wrapper.test.ts (0 test)

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯ Failed Suites 2 ⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/mock-wrapper-and-bad-dep.test.ts [ src/mock-wrapper-and-bad-dep.test.ts ]
Error: Failed to resolve entry for package "bad-dep". The package may have incorrect main/module/exports specified in its package.json.
 ❯ src/mock-wrapper-and-bad-dep.test.ts:2:1
      1| import { expect, test, vi } from "vitest";
      2| import { hello } from "./wrapper.js";
       | ^
      3|
      4| vi.mock("bad-dep", () => ({}));

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/mock-wrapper.test.ts [ src/mock-wrapper.test.ts ]
Error: Failed to resolve entry for package "bad-dep". The package may have incorrect main/module/exports specified in its package.json.
  Plugin: vite:import-analysis
  File: /home/hiroshi/code/personal/reproductions/vitest-9257-mock-bad-dep/src/wrapper.ts:2:7
  1  |  import "bad-dep";
     |          ^
  2  |  export const hello = () => "hello";
  3  |
 ❯ packageEntryFailure node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:32816:32
 ❯ resolvePackageEntry node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:32813:2
 ❯ tryNodeResolve node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:32716:70
 ❯ ResolveIdContext.handler node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:32555:16
 ❯ EnvironmentPluginContainer.resolveId node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:28717:56
 ❯ TransformPluginContext.resolve node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:28929:13
 ❯ normalizeUrl node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:27111:22
 ❯ node_modules/.pnpm/vite@7.3.1/node_modules/vite/dist/node/chunks/config.js:27177:32

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  2 failed (2)
      Tests  no tests
   Start at  15:06:35
   Duration  116ms (transform 37ms, setup 0ms, import 0ms, tests 0ms, environment 0ms)

 ELIFECYCLE  Test failed. See above for more details.
```
