// /fixtures/src/Vue/Hello.vue
const __vite_ssr_identity__ = v => v;
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["defineComponent"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["computed","ref"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["toDisplayString","createElementVNode","Fragment","openBlock","createElementBlock"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/@id/__x00__plugin-vue:export-helper", {"importedNames":["default"]});


const _sfc_main = /* @__PURE__ */ __vite_ssr_identity__(__vite_ssr_import_0__.defineComponent)({
  __name: "Hello",
  props: {
    count: { type: Number, required: true }
  },
  setup(__props, { expose: __expose }) {
    const props = __props;
    const times = __vite_ssr_identity__(__vite_ssr_import_1__.ref)(2);
    const result = __vite_ssr_identity__(__vite_ssr_import_1__.computed)(() => props.count * times.value);
    __expose(props);
    const __returned__ = { props, times, result };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return __vite_ssr_identity__(__vite_ssr_import_2__.openBlock)(), __vite_ssr_identity__(__vite_ssr_import_2__.createElementBlock)(
    __vite_ssr_identity__(__vite_ssr_import_2__.Fragment),
    null,
    [
      __vite_ssr_identity__(__vite_ssr_import_2__.createElementVNode)(
        "div",
        null,
        __vite_ssr_identity__(__vite_ssr_import_2__.toDisplayString)($props.count) + " x " + __vite_ssr_identity__(__vite_ssr_import_2__.toDisplayString)($setup.times) + " = " + __vite_ssr_identity__(__vite_ssr_import_2__.toDisplayString)($setup.result),
        1
        /* TEXT */
      ),
      __vite_ssr_identity__(__vite_ssr_import_2__.createElementVNode)("button", {
        onClick: _cache[0] || (_cache[0] = ($event) => $setup.times += 1)
      }, " x1 ")
    ],
    64
    /* STABLE_FRAGMENT */
  );
}

__vite_ssr_exports__.default = /* @__PURE__ */ __vite_ssr_identity__(__vite_ssr_import_3__.default)(_sfc_main, [["render", _sfc_render], ["__file", "/home/hiroshi/code/others/vitest/test/coverage-test/fixtures/src/Vue/Hello.vue"]]);

//# sourceMappingSource=vite-node
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTs7Ozs7O0FBQzhCOzs7Ozs7O0FBRTlCLFVBQU0sUUFBUTtBQUVkLFVBQU0sOEJBQVEsMkJBQUksQ0FBQztBQUNuQixVQUFNLCtCQUFTLGdDQUFTLE1BQU0sTUFBTSxRQUFRLE1BQU0sS0FBSztBQUV2RCxhQUFhLEtBQUs7Ozs7Ozs7O3lGQVJsQjtBQUFBO0FBQUE7QUFBQTtBQUFBLDRCQVlFO0FBQUEsUUFBbUQ7QUFBQTtBQUFBLHFFQUEzQyxZQUFLLElBQUcsOEJBQUcsdUNBQUcsWUFBSyxJQUFHLDhCQUFHLHVDQUFHLGFBQU07QUFBQTtBQUFBO0FBQUE7QUFBQSw0QkFDMUMsMENBRVM7QUFBQSxRQUZBLFNBQUssc0NBQUUsZ0JBQUs7QUFBQSxTQUFPLE1BRTVCO0FBQUEiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkhlbGxvLnZ1ZSJdLCJzb3VyY2VzQ29udGVudCI6WyI8c2NyaXB0IHNldHVwIGxhbmc9XCJ0c1wiPlxuaW1wb3J0IHsgY29tcHV0ZWQsIHJlZiB9IGZyb20gJ3Z1ZSdcblxuY29uc3QgcHJvcHMgPSBkZWZpbmVQcm9wczx7IGNvdW50OiBudW1iZXIgfT4oKVxuXG5jb25zdCB0aW1lcyA9IHJlZigyKVxuY29uc3QgcmVzdWx0ID0gY29tcHV0ZWQoKCkgPT4gcHJvcHMuY291bnQgKiB0aW1lcy52YWx1ZSlcblxuZGVmaW5lRXhwb3NlKHByb3BzKVxuPC9zY3JpcHQ+XG5cbjx0ZW1wbGF0ZT5cbiAgPGRpdj57eyBjb3VudCB9fSB4IHt7IHRpbWVzIH19ID0ge3sgcmVzdWx0IH19PC9kaXY+XG4gIDxidXR0b24gQGNsaWNrPVwidGltZXMgKz0gMVwiPlxuICAgIHgxXG4gIDwvYnV0dG9uPlxuPC90ZW1wbGF0ZT5cbiJdLCJmaWxlIjoiL2ZpeHR1cmVzL3NyYy9WdWUvSGVsbG8udnVlIn0=
