// /home/hiroshi/code/others/vitest/test/coverage-test/fixtures/test/vue-fixture.test.ts
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/packages/vitest/dist/index.js", {"importedNames":["expect","test","vi"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/@vue+test-utils@2.4.6/node_modules/@vue/test-utils/dist/vue-test-utils.cjs.js", {"importedNames":["mount"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/fixtures/src/Vue/Hello.vue", {"importedNames":["default"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/fixtures/src/Vue/Defined.vue", {"importedNames":["default"]});
const __vite_ssr_import_4__ = await __vite_ssr_import__("/fixtures/src/Vue/Counter/index.ts", {"importedNames":["CounterVue"]});





__vite_ssr_import_0__.test("vue 3 coverage", async () => {
  __vite_ssr_import_0__.expect(__vite_ssr_import_2__.default).toBeTruthy();
  const wrapper = __vite_ssr_import_1__.mount(__vite_ssr_import_2__.default, {
    props: {
      count: 4
    }
  });
  __vite_ssr_import_0__.expect(wrapper.text()).toContain("4 x 2 = 8");
  __vite_ssr_import_0__.expect(wrapper.html()).toMatchInlineSnapshot(`
    "<div>4 x 2 = 8</div>
    <button> x1 </button>"
  `);
  await wrapper.get("button").trigger("click");
  await __vite_ssr_import_0__.vi.waitFor(() => {
    __vite_ssr_import_0__.expect(wrapper.text()).toContain("4 x 3 = 12");
  });
  await wrapper.get("button").trigger("click");
  await __vite_ssr_import_0__.vi.waitFor(() => {
    __vite_ssr_import_0__.expect(wrapper.text()).toContain("4 x 4 = 16");
  });
});
__vite_ssr_import_0__.test("define package in vm", () => {
  __vite_ssr_import_0__.expect(__vite_ssr_import_3__.default).toBeTruthy();
  const wrapper = __vite_ssr_import_1__.mount(__vite_ssr_import_3__.default);
  __vite_ssr_import_0__.expect(wrapper.text()).toContain("hello");
});
__vite_ssr_import_0__.test("vue non-SFC, uses query parameters in file imports", async () => {
  const wrapper = __vite_ssr_import_1__.mount(__vite_ssr_import_4__.CounterVue);
  await wrapper.find("button").trigger("click");
  __vite_ssr_import_0__.expect(wrapper.text()).contain(1);
});

//# sourceMappingSource=vite-node
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTs7Ozs7QUFJaUM7QUFDWDtBQUNKO0FBQ0U7QUFDTztBQUUzQiwyQkFBSyxrQkFBa0IsWUFBWTtBQUNqQywrQkFBTyw2QkFBSyxFQUFFLFdBQVc7QUFFekIsUUFBTSxVQUFVLDRCQUFNLCtCQUFPO0FBQUEsSUFDM0IsT0FBTztBQUFBLE1BQ0wsT0FBTztBQUFBLElBQ1Q7QUFBQSxFQUNGLENBQUM7QUFFRCwrQkFBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLFVBQVUsV0FBVztBQUM1QywrQkFBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLHNCQUFzQjtBQUFBO0FBQUE7QUFBQSxHQUc1QztBQUVELFFBQU0sUUFBUSxJQUFJLFFBQVEsRUFBRSxRQUFRLE9BQU87QUFFM0MsUUFBTSx5QkFBRyxRQUFRLE1BQU07QUFDckIsaUNBQU8sUUFBUSxLQUFLLENBQUMsRUFBRSxVQUFVLFlBQVk7QUFBQSxFQUMvQyxDQUFDO0FBRUQsUUFBTSxRQUFRLElBQUksUUFBUSxFQUFFLFFBQVEsT0FBTztBQUUzQyxRQUFNLHlCQUFHLFFBQVEsTUFBTTtBQUNyQixpQ0FBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLFVBQVUsWUFBWTtBQUFBLEVBQy9DLENBQUM7QUFDSCxDQUFDO0FBRUQsMkJBQUssd0JBQXdCLE1BQU07QUFDakMsK0JBQU8sNkJBQU8sRUFBRSxXQUFXO0FBRTNCLFFBQU0sVUFBVSw0QkFBTSw2QkFBTztBQUU3QiwrQkFBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLFVBQVUsT0FBTztBQUMxQyxDQUFDO0FBRUQsMkJBQUssc0RBQXNELFlBQVk7QUFDckUsUUFBTSxVQUFVLDRCQUFNLGdDQUFVO0FBRWhDLFFBQU0sUUFBUSxLQUFLLFFBQVEsRUFBRSxRQUFRLE9BQU87QUFDNUMsK0JBQU8sUUFBUSxLQUFLLENBQUMsRUFBRSxRQUFRLENBQUM7QUFDbEMsQ0FBQyIsIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6W10sInNvdXJjZXMiOlsidnVlLWZpeHR1cmUudGVzdC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIEB2aXRlc3QtZW52aXJvbm1lbnQgaGFwcHktZG9tXG4gKi9cblxuaW1wb3J0IHsgZXhwZWN0LCB0ZXN0LCB2aSB9IGZyb20gJ3ZpdGVzdCdcbmltcG9ydCB7IG1vdW50IH0gZnJvbSAnQHZ1ZS90ZXN0LXV0aWxzJ1xuaW1wb3J0IEhlbGxvIGZyb20gJy4uL3NyYy9WdWUvSGVsbG8udnVlJ1xuaW1wb3J0IERlZmluZWQgZnJvbSAnLi4vc3JjL1Z1ZS9EZWZpbmVkLnZ1ZSdcbmltcG9ydCB7IENvdW50ZXJWdWUgfSBmcm9tICcuLi9zcmMvVnVlL0NvdW50ZXInXG5cbnRlc3QoJ3Z1ZSAzIGNvdmVyYWdlJywgYXN5bmMgKCkgPT4ge1xuICBleHBlY3QoSGVsbG8pLnRvQmVUcnV0aHkoKVxuXG4gIGNvbnN0IHdyYXBwZXIgPSBtb3VudChIZWxsbywge1xuICAgIHByb3BzOiB7XG4gICAgICBjb3VudDogNCxcbiAgICB9LFxuICB9KVxuXG4gIGV4cGVjdCh3cmFwcGVyLnRleHQoKSkudG9Db250YWluKCc0IHggMiA9IDgnKVxuICBleHBlY3Qod3JhcHBlci5odG1sKCkpLnRvTWF0Y2hJbmxpbmVTbmFwc2hvdChgXG4gICAgXCI8ZGl2PjQgeCAyID0gODwvZGl2PlxuICAgIDxidXR0b24+IHgxIDwvYnV0dG9uPlwiXG4gIGApXG5cbiAgYXdhaXQgd3JhcHBlci5nZXQoJ2J1dHRvbicpLnRyaWdnZXIoJ2NsaWNrJylcblxuICBhd2FpdCB2aS53YWl0Rm9yKCgpID0+IHtcbiAgICBleHBlY3Qod3JhcHBlci50ZXh0KCkpLnRvQ29udGFpbignNCB4IDMgPSAxMicpXG4gIH0pXG5cbiAgYXdhaXQgd3JhcHBlci5nZXQoJ2J1dHRvbicpLnRyaWdnZXIoJ2NsaWNrJylcblxuICBhd2FpdCB2aS53YWl0Rm9yKCgpID0+IHtcbiAgICBleHBlY3Qod3JhcHBlci50ZXh0KCkpLnRvQ29udGFpbignNCB4IDQgPSAxNicpXG4gIH0pXG59KVxuXG50ZXN0KCdkZWZpbmUgcGFja2FnZSBpbiB2bScsICgpID0+IHtcbiAgZXhwZWN0KERlZmluZWQpLnRvQmVUcnV0aHkoKVxuXG4gIGNvbnN0IHdyYXBwZXIgPSBtb3VudChEZWZpbmVkKVxuXG4gIGV4cGVjdCh3cmFwcGVyLnRleHQoKSkudG9Db250YWluKCdoZWxsbycpXG59KVxuXG50ZXN0KCd2dWUgbm9uLVNGQywgdXNlcyBxdWVyeSBwYXJhbWV0ZXJzIGluIGZpbGUgaW1wb3J0cycsIGFzeW5jICgpID0+IHtcbiAgY29uc3Qgd3JhcHBlciA9IG1vdW50KENvdW50ZXJWdWUpXG5cbiAgYXdhaXQgd3JhcHBlci5maW5kKCdidXR0b24nKS50cmlnZ2VyKCdjbGljaycpXG4gIGV4cGVjdCh3cmFwcGVyLnRleHQoKSkuY29udGFpbigxKVxufSlcbiJdLCJmaWxlIjoiL2hvbWUvaGlyb3NoaS9jb2RlL290aGVycy92aXRlc3QvdGVzdC9jb3ZlcmFnZS10ZXN0L2ZpeHR1cmVzL3Rlc3QvdnVlLWZpeHR1cmUudGVzdC50cyJ9
