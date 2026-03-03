// copied from vite/src/shared/utils.ts
const postfixRE = /[?#].*$/
function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}
function splitFileAndPostfix(path: string): { file: string; postfix: string } {
  const file = cleanUrl(path)
  return { file, postfix: path.slice(file.length) }
}

// copied from vite/src/node/utils.ts
export function injectQuery(url: string, queryToInject: string): string {
  const { file, postfix } = splitFileAndPostfix(url)
  return `${file}?${queryToInject}${postfix[0] === '?' ? `&${postfix.slice(1)}` : /* hash only */ postfix}`
}

export function removeQuery(url: string, queryToRemove: string): string {
  return url
    .replace(new RegExp(`[?&]${queryToRemove}(?=[&#]|$)`), '')
    .replace(/\?$/, '')
}
