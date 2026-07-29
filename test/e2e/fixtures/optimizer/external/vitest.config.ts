import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          // need at least one to trigger dep optimization
          include: ["@vitest/test-dep-optimizer-optimized"],
        },
      },
    },
  },
  plugins: [
    {
      name: 'test-external',
      transform(_code, id, _options) {
        if (id.includes('test-dep-optimizer-external')) {
          this.error('"@vitest/test-dep-optimizer-external" is expected to be externalized');
        }
      },
    }
  ]
});
