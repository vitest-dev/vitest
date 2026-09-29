// This package has invalid JavaScript so the test fails if Vite's optimizer
// scans the dependency imported from index.html.
export default function broken(input: {| value: string |}) {
  return input.value
}
