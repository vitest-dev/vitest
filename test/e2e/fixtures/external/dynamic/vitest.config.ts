import { defineConfig } from "vitest/config";

export default defineConfig({
  ssr: {
    noExternal: ["@vitejs/test-dep-virtual"],
  },
  plugins: [
    {
      name: 'test-virtual',
      resolveId(source) {
        if (source === 'virtual:test') {
          return '\0' + source;
        }
      },
      load(id) {
        if (id === '\0virtual:test') {
          return `export const test = "ok";`;
        }
      }
    }
  ],
});
