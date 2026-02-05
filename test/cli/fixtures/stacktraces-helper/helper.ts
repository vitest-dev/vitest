// TODO:
// slice traces deeper than __VITEST_SKIP_TRACE__ and __VITEST_SKIP_TRACE_ASYNC__
// around `onStackTrace` logic packages/utils/src/source-map.ts
// NOTE: captureStackTrace isn't enough to support expect.soft
export function helper<F extends (...args: any) => any>(fn: F): F {
  function __VITEST_SKIP_TRACE__(...args: any[]): any {
    // const result = fn(...args)
    // return result;
    try {
      const result = fn(...args);
      if (result && typeof result === "object" && typeof result.then === "function") {
        // return (result as PromiseLike<any>).then(undefined, (err) => {
        //   console.log(err)
        //   // Error.captureStackTrace(err, helper);
        //   throw err;
        // })
        return (async function __VITEST_SKIP_TRACE_ASYNC__() {
          return await result;
        })();
        // return (async function __VITEST_SKIP_TRACE_ASYNC__() {
        //   await result;
        // })().catch((err) => {
        //   // Error.captureStackTrace(err, __VITEST_SKIP_TRACE__);
        //   throw err;
        // });
      }
      return result;
    } catch (e) {
      // Error.captureStackTrace(e as Error, __VITEST_SKIP_TRACE__);
      throw e;
    }
  }
  return __VITEST_SKIP_TRACE__ as F;
}
