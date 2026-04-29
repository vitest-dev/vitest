import { expect, it } from 'vitest'

it('should have sourcemaps', () => {
  expect('\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9').toBeTruthy()
  // eslint-disable-next-line style/quotes
  expect("\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9").toBeTruthy()
  expect(`\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9`).toBeTruthy()
})
