/**
 * The variable below is modified by custom Vite plugin
 */
export const padding = 'default-padding'

export function run(name: string) {
  /*
   * These if-branches should show correctly on coverage report.
   * Otherwise source maps are off.
   */
  if (name === 'not-covered') {
    // This is not covered by any test
    return 0
  }
  // Comment
  else if (name === 'project-1') {
    // This is covered by Project #1
    return 1
  }
  else if (name === 'not-covered-2') {
    // This is not covered by any test
    return 0
  }
  else if (name === 'project-2') {
    // This is covered by Project #2
    return 2
  }

  // This is covered by both projects, should show 2x hits
  return 3
}
