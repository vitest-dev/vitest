// /fixtures/src/Vue/Hello.vue
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["defineComponent"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["computed","ref"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/vue@3.4.37_typescript@5.5.4/node_modules/vue/index.mjs", {"importedNames":["toDisplayString","createElementVNode","Fragment","openBlock","createElementBlock"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/@id/__x00__plugin-vue:export-helper", {"importedNames":["default"]});


const _sfc_main = /* @__PURE__ */ __vite_ssr_import_0__.defineComponent({
  __name: "Hello",
  props: {
    count: { type: Number, required: true }
  },
  setup(__props, { expose: __expose }) {
    const props = __props;
    const times = __vite_ssr_import_1__.ref(2);
    const result = __vite_ssr_import_1__.computed(() => props.count * times.value);
    __expose(props);
    const __returned__ = { props, times, result };
    Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
    return __returned__;
  }
});

function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return __vite_ssr_import_2__.openBlock(), __vite_ssr_import_2__.createElementBlock(
    __vite_ssr_import_2__.Fragment,
    null,
    [
      __vite_ssr_import_2__.createElementVNode(
        "div",
        null,
        __vite_ssr_import_2__.toDisplayString($props.count) + " x " + __vite_ssr_import_2__.toDisplayString($setup.times) + " = " + __vite_ssr_import_2__.toDisplayString($setup.result),
        1
        /* TEXT */
      ),
      __vite_ssr_import_2__.createElementVNode("button", {
        onClick: _cache[0] || (_cache[0] = ($event) => $setup.times += 1)
      }, " x1 ")
    ],
    64
    /* STABLE_FRAGMENT */
  );
}

__vite_ssr_exports__.default = /* @__PURE__ */ __vite_ssr_import_3__.default(_sfc_main, [["render", _sfc_render], ["__file", "/home/hiroshi/code/others/vitest/test/coverage-test/fixtures/src/Vue/Hello.vue"]]);

//# sourceMappingSource=vite-node
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTs7Ozs7QUFDOEI7Ozs7Ozs7QUFFOUIsVUFBTSxRQUFRO0FBRWQsVUFBTSxRQUFRLDBCQUFJLENBQUM7QUFDbkIsVUFBTSxTQUFTLCtCQUFTLE1BQU0sTUFBTSxRQUFRLE1BQU0sS0FBSztBQUV2RCxhQUFhLEtBQUs7Ozs7Ozs7OzRDQVJsQjtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BWUU7QUFBQSxRQUFtRDtBQUFBO0FBQUEsOENBQTNDLFlBQUssSUFBRyxRQUFHLHNDQUFHLFlBQUssSUFBRyxRQUFHLHNDQUFHLGFBQU07QUFBQTtBQUFBO0FBQUE7QUFBQSxNQUMxQyx5Q0FFUztBQUFBLFFBRkEsU0FBSyxzQ0FBRSxnQkFBSztBQUFBLFNBQU8sTUFFNUI7QUFBQSIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsiSGVsbG8udnVlIl0sInNvdXJjZXNDb250ZW50IjpbIjxzY3JpcHQgc2V0dXAgbGFuZz1cInRzXCI+XG5pbXBvcnQgeyBjb21wdXRlZCwgcmVmIH0gZnJvbSAndnVlJ1xuXG5jb25zdCBwcm9wcyA9IGRlZmluZVByb3BzPHsgY291bnQ6IG51bWJlciB9PigpXG5cbmNvbnN0IHRpbWVzID0gcmVmKDIpXG5jb25zdCByZXN1bHQgPSBjb21wdXRlZCgoKSA9PiBwcm9wcy5jb3VudCAqIHRpbWVzLnZhbHVlKVxuXG5kZWZpbmVFeHBvc2UocHJvcHMpXG48L3NjcmlwdD5cblxuPHRlbXBsYXRlPlxuICA8ZGl2Pnt7IGNvdW50IH19IHgge3sgdGltZXMgfX0gPSB7eyByZXN1bHQgfX08L2Rpdj5cbiAgPGJ1dHRvbiBAY2xpY2s9XCJ0aW1lcyArPSAxXCI+XG4gICAgeDFcbiAgPC9idXR0b24+XG48L3RlbXBsYXRlPlxuIl0sImZpbGUiOiIvZml4dHVyZXMvc3JjL1Z1ZS9IZWxsby52dWUifQ==
