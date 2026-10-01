import { defaultServerConditions } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    "import.meta.__IS_INLINE__": "true",
  },
  ssr: {
    resolve: {
      conditions: ["custom", ...defaultServerConditions.filter((c) => c !== "module")],
    },
  },
});
