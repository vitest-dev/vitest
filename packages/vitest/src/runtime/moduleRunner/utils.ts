// copied from vite
// https://github.com/vitejs/vite/blob/4417b4f305623b2850bd6ae6553834c017694672/packages/vite/src/shared/utils.ts
// https://github.com/vitejs/vite/blob/4417b4f305623b2850bd6ae6553834c017694672/packages/vite/src/node/utils.ts
const postfixRE = /[?#].*$/
const trailingSeparatorRE = /[?&]$/

function cleanUrl(url: string): string {
  return url.replace(postfixRE, '')
}
function splitFileAndPostfix(path: string): { file: string; postfix: string } {
  const file = cleanUrl(path)
  return { file, postfix: path.slice(file.length) }
}

export function injectQuery(url: string, queryToInject: string): string {
  const { file, postfix } = splitFileAndPostfix(url)
  return `${file}?${queryToInject}${postfix[0] === '?' ? `&${postfix.slice(1)}` : /* hash only */ postfix}`
}

export function removeQuery(url: string, queryToRemove: string): string {
  return url
    .replace(new RegExp(`([?&])${queryToRemove}(?:&|$)`), '$1')
    .replace(trailingSeparatorRE, '')
}
