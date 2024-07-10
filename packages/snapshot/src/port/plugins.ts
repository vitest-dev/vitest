/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Plugin as PrettyFormatPlugin,
  Plugins as PrettyFormatPlugins,
} from '@vitest/pretty-format'
import { plugins as prettyFormatPlugins } from '@vitest/pretty-format'

import MockSerializer from './mockSerializer'

const {
  DOMCollection,
  DOMElement,
  Immutable,
  ReactElement,
  ReactTestComponent,
  AsymmetricMatcher,
} = prettyFormatPlugins

let PLUGINS: PrettyFormatPlugins = [
  ReactTestComponent,
  ReactElement,
  DOMElement,
  DOMCollection,
  Immutable,
  AsymmetricMatcher,
  MockSerializer,
]

export function addSerializer(plugin: PrettyFormatPlugin): void {
  PLUGINS = [plugin].concat(PLUGINS)
}

export function getSerializers(): PrettyFormatPlugins {
  return PLUGINS
}
