/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export interface ByRoleOptions {
  checked?: boolean
  disabled?: boolean
  exact?: boolean
  expanded?: boolean
  includeHidden?: boolean
  level?: number
  name?: string | RegExp
  pressed?: boolean
  selected?: boolean
}

function getByAttributeTextSelector(attrName: string, text: string | RegExp, options?: { exact?: boolean }): string {
  return `internal:attr=[${attrName}=${escapeForAttributeSelector(text, options?.exact || false)}]`
}

export function getByTestIdSelector(testIdAttributeName: string, testId: string | RegExp): string {
  return `internal:testid=[${testIdAttributeName}=${escapeForAttributeSelector(testId, true)}]`
}

export function getByLabelSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return `internal:label=${escapeForTextSelector(text, !!options?.exact)}`
}

export function getByAltTextSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return getByAttributeTextSelector('alt', text, options)
}

export function getByTitleSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return getByAttributeTextSelector('title', text, options)
}

export function getByPlaceholderSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return getByAttributeTextSelector('placeholder', text, options)
}

export function getByTextSelector(text: string | RegExp, options?: { exact?: boolean }): string {
  return `internal:text=${escapeForTextSelector(text, !!options?.exact)}`
}

export function getByRoleSelector(role: string, options: ByRoleOptions = {}): string {
  const props: string[][] = []
  if (options.checked !== undefined) {
    props.push(['checked', String(options.checked)])
  }
  if (options.disabled !== undefined) {
    props.push(['disabled', String(options.disabled)])
  }
  if (options.selected !== undefined) {
    props.push(['selected', String(options.selected)])
  }
  if (options.expanded !== undefined) {
    props.push(['expanded', String(options.expanded)])
  }
  if (options.includeHidden !== undefined) {
    props.push(['include-hidden', String(options.includeHidden)])
  }
  if (options.level !== undefined) {
    props.push(['level', String(options.level)])
  }
  if (options.name !== undefined) {
    props.push(['name', escapeForAttributeSelector(options.name, !!options.exact)])
  }
  if (options.pressed !== undefined) {
    props.push(['pressed', String(options.pressed)])
  }
  return `internal:role=${role}${props.map(([n, v]) => `[${n}=${v}]`).join('')}`
}

function escapeRegexForSelector(re: RegExp): string {
  // Unicode mode does not allow "identity character escapes", so we do not escape and
  // hope that it does not contain quotes and/or >> signs.
  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Regular_expressions/Character_escape
  // TODO: rework RE usages in internal selectors away from literal representation to json, e.g. {source,flags}.
  if (re.unicode || (re as any).unicodeSets) {
    return String(re)
  }
  // Even number of backslashes followed by the quote -> insert a backslash.
  return String(re).replace(/(^|[^\\])(\\\\)*(["'`])/g, '$1$2\\$3').replace(/>>/g, '\\>\\>')
}

export function escapeForTextSelector(text: string | RegExp, exact: boolean): string {
  if (typeof text !== 'string') {
    return escapeRegexForSelector(text)
  }
  return `${JSON.stringify(text)}${exact ? 's' : 'i'}`
}

export function escapeForAttributeSelector(value: string | RegExp, exact: boolean): string {
  if (typeof value !== 'string') {
    return escapeRegexForSelector(value)
  }
  // TODO: this should actually be
  //   cssEscape(value).replace(/\\ /g, ' ')
  // However, our attribute selectors do not conform to CSS parsing spec,
  // so we escape them differently.
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"${exact ? 's' : 'i'}`
}
