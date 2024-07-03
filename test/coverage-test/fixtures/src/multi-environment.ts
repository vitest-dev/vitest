/**
 * The variable below is modified by custom Vite plugin
 */
export const padding = 'default-padding'

export function sum(a: number, b: number) {
  /*
   * These if-branches should show correctly on coverage report.
   * Otherwise source maps are off.
   */
  if (a === 8 && b === 9) {
    // This is not covered by any test
    return 17
  }
  // Comment
  else if (a === 2 && b === 2) {
    // This is covered by SSR test
    return 4
  }
  else if (a === 11 && b === 22) {
    // This is not covered by any test
    return 33
  }
  else if (a === 10 && b === 23) {
    // This is covered by Web test
    return 33
  }

  // This is covered by SSR and Web test, should show 2x hits
  return a + b
}
