import { readFileSync } from "node:fs";
import { Plugin, defineWorkspace } from "vitest/config";
import MagicString from "magic-string";

export default defineWorkspace([
  // Project that uses its own "root" and custom transform plugin
  {
    test: {
      name: "custom-with-root",
      root: "fixtures/workspaces/custom-2",
    },
    plugins: [customFilePlugin("2")],
  },

  // Project that cannot transform "*.custom-x" files
  {
    test: {
      name: "normal",
      include: ["fixtures/test/math.test.ts"],
    },
  },

  // Project that uses default "root" and has custom transform plugin
  {
    test: {
      name: "custom",
      include: ["fixtures/test/custom-1-syntax.test.ts"],
    },
    plugins: [customFilePlugin("1")],
  },
]);

/**
 * Plugin for transforming `.custom-1` and/or `.custom-2` files to Javascript
 */
function customFilePlugin(postfix: "1" | "2"): Plugin {
  function transform(code: MagicString) {
    code.replaceAll(
      "<function covered>",
      `
function covered() {
  return "Custom-${postfix} file loaded!"
}
  `.trim()
    );

    code.replaceAll(
      "<function uncovered>",
      `
function uncovered() {
  return "This should be uncovered!"
}
    `.trim()
    );

    code.replaceAll("<default export covered>", "export default covered()");
    code.replaceAll("<default export uncovered>", "export default uncovered()");
  }

  return {
    name: `custom-${postfix}-file-plugin`,
    transform(_, id) {
      const filename = id.split("?")[0];

      if (filename.endsWith(`.custom-${postfix}`)) {
        const content = readFileSync(filename, "utf8");

        const s = new MagicString(content);
        transform(s);

        return {
          code: s.toString(),
          map: s.generateMap({ hires: "boundary" }),
        };
      }
    },
  };
}
