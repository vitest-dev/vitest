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

let PLUGINS: PrettyFormatPlugins = [
  prettyFormatPlugins.ReactTestComponent,
  prettyFormatPlugins.ReactElement,
  prettyFormatPlugins.DOMElement,
  prettyFormatPlugins.DOMCollection,
  prettyFormatPlugins.Immutable,
  prettyFormatPlugins.AsymmetricMatcher,
  MockSerializer,
]

export function addSerializer(plugin: PrettyFormatPlugin): void {
  PLUGINS = [plugin].concat(PLUGINS)
}

export function getSerializers(): PrettyFormatPlugins {
  return PLUGINS
}
