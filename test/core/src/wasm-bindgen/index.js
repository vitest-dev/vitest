/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// folder source: https://github.com/rustwasm/wasm-bindgen/tree/4f865308afbe8d2463968457711ad356bae63b71/examples/hello_world
// docs: https://rustwasm.github.io/docs/wasm-bindgen/examples/hello-world.html

// for this to work on vm, both index_bg.js and index_bg.wasm need to be externalized

import * as wasm from './index_bg.wasm'
import { __wbg_set_wasm } from './index_bg.js'

__wbg_set_wasm(wasm)
export * from './index_bg.js'
