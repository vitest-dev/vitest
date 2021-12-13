/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type {
  Plugin as PrettyFormatPlugin,
  Plugins as PrettyFormatPlugins,
} from 'pretty-format'
import {
  plugins as prettyFormatPlugins,
} from 'pretty-format'

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
  // TODO: write sinon mock serializer
  // https://github.com/facebook/jest/blob/4eb4f6a59b6eae0e05b8e51dd8cd3fdca1c7aff1/packages/jest-snapshot/src/mockSerializer.ts#L4
]

// TODO: expose these and allow user to add custom serializers
// Prepend to list so the last added is the first tested.
export const addSerializer = (plugin: PrettyFormatPlugin): void => {
  PLUGINS = [plugin].concat(PLUGINS)
}

export const getSerializers = (): PrettyFormatPlugins => PLUGINS
