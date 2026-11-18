import { Plugin, defineConfig } from "vitest/config";
import MagicString from "magic-string";

export default defineConfig({
  test: {
    projects: [
      // Root "app" is a string prefix of "app-utils"
      {
        test: { name: "app", root: "fixtures/workspaces/prefix-roots/app" },
        plugins: [renameFunctionPlugin("transformedByApp")],
      },
      {
        test: { name: "app-utils", root: "fixtures/workspaces/prefix-roots/app-utils" },
        plugins: [renameFunctionPlugin("transformedByAppUtils")],
      },
    ],
  },
});

function renameFunctionPlugin(name: string): Plugin {
  return {
    name: "rename-function-plugin",
    transform(code, id) {
      if (!id.includes("/prefix-roots/") || !code.includes("__project__")) {
        return;
      }

      const s = new MagicString(code);
      s.replaceAll("__project__", name);

      return { code: s.toString(), map: s.generateMap({ hires: "boundary" }) };
    },
  };
}
