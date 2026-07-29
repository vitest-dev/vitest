/**
 * Some padding
 */
export function uncovered() {
  return "uncoverd";
}

/**
 * Some padding
 */

export function throwsError(condition: Boolean) {
  /**
   * Some padding
   */

  if(condition === false) {
    /**
     * Some padding
     */

    return;
  }

  /**
   * Some padding
   */
   function throws() {
     throw new Error("Expected error")
   }
  /**
   * Some padding
   */
   throws()
}

/**
 * Some padding
 */
export function uncovered2() {
  return "uncoverd";
}
