/* eslint-disable unused-imports/no-unused-vars -- intentional */
export function add(a: number, b: number) {
  /**
   * Multi
   * line
   * comment
   */
  if (a === 2 && b === 3) {
    // This line should NOT be covered
    return 5
  }

  type TypescriptTypings = 1 | 2

  if (a === 1 && b === 1) {
    // This line should NOT be covered
    return 2
  }

  interface MoreCompileTimeCode {
    should: {
      be: {
        excluded: true
      }
    }
  }

  return a + b
}
