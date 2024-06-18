export function replacer(code: string, values: Record<string, string>) {
  return code.replace(/\{\s*(\w+)\s*\}/g, (_, key) => values[key] ?? '')
}
