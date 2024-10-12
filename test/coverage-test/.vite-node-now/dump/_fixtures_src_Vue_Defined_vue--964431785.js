// /fixtures/src/Vue/Defined.vue
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["defineComponent"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["toDisplayString"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/fixtures/src/Vue/Defined.vue?vue&type=style&index=0&scoped=f7f04e08&lang.css");
const __vite_ssr_import_3__ = await __vite_ssr_import__("/@id/__x00__plugin-vue:export-helper", {"importedNames":["default"]});

const defined = "hello";
const _sfc_main = /* @__PURE__ */ __vite_ssr_import_0__.defineComponent({
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
  return __vite_ssr_import_1__.toDisplayString($setup.defined);
}


__vite_ssr_exports__.default = /* @__PURE__ */ __vite_ssr_import_3__.default(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-f7f04e08"], ["__file", "/home/hiroshi/code/others/vitest/test/coverage-test/fixtures/src/Vue/Defined.vue"]]);

//# sourceMappingSource=vite-node
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTs7Ozs7QUFDQSxNQUFNLFVBQVU7Ozs7O0FBR2hCLFFBQUksU0FBUztBQUNYLGNBQVEsSUFBSSxtQkFBbUI7QUFBQSxJQUNqQyxPQUNLO0FBQ0gsY0FBUSxJQUFJLHFCQUFxQjtBQUFBLElBQ25DOzs7Ozs7OzsrQ0FJSyxjQUFPIiwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJEZWZpbmVkLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuY29uc3QgZGVmaW5lZCA9ICdoZWxsbydcblxuLyogZXNsaW50LWRpc2FibGUgbm8tY29uc29sZSAqL1xuaWYgKGRlZmluZWQpIHtcbiAgY29uc29sZS5sb2coJ0NvdmVyZWQgY29uZGl0aW9uJylcbn1cbmVsc2Uge1xuICBjb25zb2xlLmxvZygnVW5jb3ZlcmVkIGNvbmRpdGlvbicpXG59XG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICB7eyBkZWZpbmVkIH19XG48L3RlbXBsYXRlPlxuXG48IS0tIFN0eWxlIGJsb2NrIHRyaWdnZXJzIGEgc3BlY2lmaWMgY29uZGl0aW9uIHdoZXJlIHNvdXJjZW1hcHMgdXNlZCB0byBicmVhayByYW5kb21seSAtLT5cbjxzdHlsZSBsYW5nPVwiY3NzXCIgc2NvcGVkPlxuYm9keSB7XG4gIGJhY2tncm91bmQtY29sb3I6ICNGRkY7XG59XG48L3N0eWxlPlxuIl0sImZpbGUiOiIvZml4dHVyZXMvc3JjL1Z1ZS9EZWZpbmVkLnZ1ZSJ9
