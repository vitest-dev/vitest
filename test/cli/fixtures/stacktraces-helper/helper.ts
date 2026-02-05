export function helper<F extends (...args: any) => any>(fn: F): F {
  function __VITEST_SKIP_TRACE__(...args: any[]): any {
    const result = fn(...args);
    if (result && typeof result === "object" && typeof result.then === "function") {
      return (async function __VITEST_SKIP_TRACE_ASYNC__() {
        return await result;
      })();
    }
    return result;
  }
  return __VITEST_SKIP_TRACE__ as F;
}
