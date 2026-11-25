export function loadModule(path: string) {
  return import(/* @vite-ignore */ path)
}
