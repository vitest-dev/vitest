// /fixtures/src/Vue/Defined.vue
const __vite_ssr_identity__ = v => v;
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["defineComponent"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["toDisplayString"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/fixtures/src/Vue/Defined.vue?vue&type=style&index=0&scoped=f7f04e08&lang.css");
const __vite_ssr_import_3__ = await __vite_ssr_import__("/@id/__x00__plugin-vue:export-helper", {"importedNames":["default"]});

const defined = "hello";
const _sfc_main = /* @__PURE__ */ __vite_ssr_identity__(__vite_ssr_import_0__.defineComponent)({
  __name: "Defined",
  setup(__props, { expose: __expose }) {
    __expose();
    if (defined) {
      console.log("Covered condition");
    } else {
      console.log("Uncovered condition");
    }
    const __returned__ = { defined };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return __vite_ssr_identity__(__vite_ssr_import_1__.toDisplayString)($setup.defined);
}


__vite_ssr_exports__.default = /* @__PURE__ */ __vite_ssr_identity__(__vite_ssr_import_3__.default)(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-f7f04e08"], ["__file", "/home/hiroshi/code/others/vitest/test/coverage-test/fixtures/src/Vue/Defined.vue"]]);

//# sourceMappingSource=vite-node
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTs7Ozs7O0FBQ0EsTUFBTSxVQUFVOzs7OztBQUdoQixRQUFJLFNBQVM7QUFDWCxjQUFRLElBQUksbUJBQW1CO0FBQUEsSUFDakMsT0FDSztBQUNILGNBQVEsSUFBSSxxQkFBcUI7QUFBQSxJQUNuQzs7Ozs7Ozs7c0VBSUssY0FBTyIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiRGVmaW5lZC52dWUiXSwic291cmNlc0NvbnRlbnQiOlsiPHNjcmlwdCBzZXR1cCBsYW5nPVwidHNcIj5cbmNvbnN0IGRlZmluZWQgPSAnaGVsbG8nXG5cbi8qIGVzbGludC1kaXNhYmxlIG5vLWNvbnNvbGUgKi9cbmlmIChkZWZpbmVkKSB7XG4gIGNvbnNvbGUubG9nKCdDb3ZlcmVkIGNvbmRpdGlvbicpXG59XG5lbHNlIHtcbiAgY29uc29sZS5sb2coJ1VuY292ZXJlZCBjb25kaXRpb24nKVxufVxuPC9zY3JpcHQ+XG5cbjx0ZW1wbGF0ZT5cbiAge3sgZGVmaW5lZCB9fVxuPC90ZW1wbGF0ZT5cblxuPCEtLSBTdHlsZSBibG9jayB0cmlnZ2VycyBhIHNwZWNpZmljIGNvbmRpdGlvbiB3aGVyZSBzb3VyY2VtYXBzIHVzZWQgdG8gYnJlYWsgcmFuZG9tbHkgLS0+XG48c3R5bGUgbGFuZz1cImNzc1wiIHNjb3BlZD5cbmJvZHkge1xuICBiYWNrZ3JvdW5kLWNvbG9yOiAjRkZGO1xufVxuPC9zdHlsZT5cbiJdLCJmaWxlIjoiL2ZpeHR1cmVzL3NyYy9WdWUvRGVmaW5lZC52dWUifQ==
