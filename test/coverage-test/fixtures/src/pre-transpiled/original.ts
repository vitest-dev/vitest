export const hello = (arg?: unknown) => {
  if (arg) {
    // Uncovered
    noop();
  }

  // Covered
  noop();

  if (arg === 3) {
    // Uncovered
    noop();
  }

  if (arg === undefined) {
    // Covered
    noop();
  }
};

function noop() {}
