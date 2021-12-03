/**
 * Copyright (c) Facebook, Inc. and its affiliates. All Rights Reserved.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import path from 'path'

export const replaceRootDirInPath = (
  rootDir: string,
  filePath: string,
): string => {
  if (!/^<rootDir>/.test(filePath))
    return filePath

  return path.resolve(
    rootDir,
    path.normalize(`./${filePath.substr('<rootDir>'.length)}`),
  )
}

export function replaceRootDirInObject<T>(rootDir: string, config: T): T {
  const newConfig = {} as T
  for (const configKey of Object.keys(config) as (keyof T)[]) {
    newConfig[configKey]
      = configKey === 'rootDir'
        ? config[configKey]
        : _replaceRootDirTags(rootDir, config[configKey])
  }
  return newConfig
}

export function _replaceRootDirTags<T>(rootDir: string,
  config: T): T {
  if (config == null)
    return config

  switch (typeof config) {
    case 'object':
      if (Array.isArray(config)) {
        /// can be string[] or {}[]
        return config.map(item => _replaceRootDirTags(rootDir, item)) as unknown as T
      }
      if (config instanceof RegExp)
        return config

      return replaceRootDirInObject(rootDir, config) as T
    case 'string':
      return replaceRootDirInPath(rootDir, config) as unknown as T
  }
  return config
}
