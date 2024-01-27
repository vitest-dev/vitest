/* eslint-disable no-console */

/*
script to check nodejs's behavior

node test/vm-threads/src/external/not-found-demo.js
:::
::: external
:::
Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@vitest/non-existing-module' imported from /home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found.js
    at packageResolve (node:internal/modules/esm/resolve:853:9)
    at moduleResolve (node:internal/modules/esm/resolve:910:20)
    at defaultResolve (node:internal/modules/esm/resolve:1130:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:396:12)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:365:25)
    at ModuleLoader.getModuleJob (node:internal/modules/esm/loader:240:38)
    at ModuleLoader.import (node:internal/modules/esm/loader:328:34)
    at importModuleDynamically (node:internal/modules/esm/translators:158:35)
    at importModuleDynamicallyCallback (node:internal/modules/esm/utils:207:14)
    at Module.importExternal (file:///home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found.js:2:3) {
  code: 'ERR_MODULE_NOT_FOUND'
}
:::
::: internal
:::
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/home/hiroshi/code/others/vitest/test/vm-threads/src/external/non-existing-module' imported from /home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found.js
    at finalizeResolution (node:internal/modules/esm/resolve:264:11)
    at moduleResolve (node:internal/modules/esm/resolve:917:10)
    at defaultResolve (node:internal/modules/esm/resolve:1130:11)
    at ModuleLoader.defaultResolve (node:internal/modules/esm/loader:396:12)
    at ModuleLoader.resolve (node:internal/modules/esm/loader:365:25)
    at ModuleLoader.getModuleJob (node:internal/modules/esm/loader:240:38)
    at ModuleLoader.import (node:internal/modules/esm/loader:328:34)
    at importModuleDynamically (node:internal/modules/esm/translators:158:35)
    at importModuleDynamicallyCallback (node:internal/modules/esm/utils:207:14)
    at Module.importInternal (file:///home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found.js:6:3) {
  code: 'ERR_MODULE_NOT_FOUND',
  url: 'file:///home/hiroshi/code/others/vitest/test/vm-threads/src/external/non-existing-module'
}
*/

import * as notFound from './not-found.js'

console.log(':::')
console.log('::: external')
console.log(':::')
await notFound.importExternal().catch(e => console.error(e))

console.log(':::')
console.log('::: internal')
console.log(':::')
await notFound.importInternal().catch(e => console.error(e))
