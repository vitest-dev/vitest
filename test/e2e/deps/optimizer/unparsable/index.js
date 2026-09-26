// Intentionally not parseable as JavaScript, mirroring Flow-annotated sources
// published by some packages (the exact syntax is Flow-only: exact object type).
export default function broken(input: {| value: string |}) {
  return input.value
}
