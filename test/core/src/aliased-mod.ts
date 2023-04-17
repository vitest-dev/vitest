export const isAliased = true

export function getPaths() {
  return {
    __filename,
    __dirname,
    url: import.meta.url,
  }
}
