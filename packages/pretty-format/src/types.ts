/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface Colors {
  comment: { close: string; open: string }
  content: { close: string; open: string }
  prop: { close: string; open: string }
  tag: { close: string; open: string }
  value: { close: string; open: string }
}
type Indent = (arg0: string) => string
export type Refs = Array<unknown>
type Print = (arg0: unknown) => string

export type Theme = Required<{
  comment?: string
  content?: string
  prop?: string
  tag?: string
  value?: string
}>

/**
 * compare function used when sorting object keys, `null` can be used to skip over sorting.
 */
export type CompareKeys = ((a: string, b: string) => number) | null | undefined

type RequiredOptions = Required<PrettyFormatOptions>

export interface Options
  extends Omit<RequiredOptions, 'compareKeys' | 'theme'> {
  compareKeys: CompareKeys
  theme: Theme
}

export interface PrettyFormatOptions {
  callToJSON?: boolean
  escapeRegex?: boolean
  escapeString?: boolean
  highlight?: boolean
  indent?: number
  maxDepth?: number
  maxWidth?: number
  min?: boolean
  printBasicPrototype?: boolean
  printFunctionName?: boolean
  compareKeys?: CompareKeys
  plugins?: Plugins
}

export type OptionsReceived = PrettyFormatOptions

export interface Config {
  callToJSON: boolean
  compareKeys: CompareKeys
  colors: Colors
  escapeRegex: boolean
  escapeString: boolean
  indent: string
  maxDepth: number
  maxWidth: number
  min: boolean
  plugins: Plugins
  printBasicPrototype: boolean
  printFunctionName: boolean
  spacingInner: string
  spacingOuter: string
}

export type Printer = (
  val: unknown,
  config: Config,
  indentation: string,
  depth: number,
  refs: Refs,
  hasCalledToJSON?: boolean,
) => string

type Test = (arg0: any) => boolean

export interface NewPlugin {
  serialize: (
    val: any,
    config: Config,
    indentation: string,
    depth: number,
    refs: Refs,
    printer: Printer,
  ) => string
  test: Test
}

interface PluginOptions {
  edgeSpacing: string
  min: boolean
  spacing: string
}

export interface OldPlugin {
  print: (
    val: unknown,
    print: Print,
    indent: Indent,
    options: PluginOptions,
    colors: Colors,
  ) => string
  test: Test
}

export type Plugin = NewPlugin | OldPlugin

export type Plugins = Array<Plugin>
