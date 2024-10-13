// /home/hiroshi/code/others/vitest/test/coverage-test/fixtures/test/vue-fixture.test.ts
const __vite_ssr_identity__ = v => v;
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/packages/vitest/dist/index.js", {"importedNames":["expect","test","vi"]});
const __vite_ssr_import_1__ = await __vite_ssr_import__("/@fs/home/hiroshi/code/others/vitest/node_modules/.pnpm/@vue+test-utils@2.4.6/node_modules/@vue/test-utils/dist/vue-test-utils.cjs.js", {"importedNames":["mount"]});
const __vite_ssr_import_2__ = await __vite_ssr_import__("/fixtures/src/Vue/Hello.vue", {"importedNames":["default"]});
const __vite_ssr_import_3__ = await __vite_ssr_import__("/fixtures/src/Vue/Defined.vue", {"importedNames":["default"]});
const __vite_ssr_import_4__ = await __vite_ssr_import__("/fixtures/src/Vue/Counter/index.ts", {"importedNames":["CounterVue"]});





__vite_ssr_identity__(__vite_ssr_import_0__.test)("vue 3 coverage", async () => {
  __vite_ssr_identity__(__vite_ssr_import_0__.expect)(__vite_ssr_identity__(__vite_ssr_import_2__.default)).toBeTruthy();
  const wrapper = __vite_ssr_identity__(__vite_ssr_import_1__.mount)(__vite_ssr_identity__(__vite_ssr_import_2__.default), {
    props: {
      count: 4
    }
  });
  __vite_ssr_identity__(__vite_ssr_import_0__.expect)(wrapper.text()).toContain("4 x 2 = 8");
  __vite_ssr_identity__(__vite_ssr_import_0__.expect)(wrapper.html()).toMatchInlineSnapshot(`
    "<div>4 x 2 = 8</div>
    <button> x1 </button>"
  `);
  await wrapper.get("button").trigger("click");
  await __vite_ssr_import_0__.vi.waitFor(() => {
    __vite_ssr_identity__(__vite_ssr_import_0__.expect)(wrapper.text()).toContain("4 x 3 = 12");
  });
  await wrapper.get("button").trigger("click");
  await __vite_ssr_import_0__.vi.waitFor(() => {
    __vite_ssr_identity__(__vite_ssr_import_0__.expect)(wrapper.text()).toContain("4 x 4 = 16");
  });
});
__vite_ssr_identity__(__vite_ssr_import_0__.test)("define package in vm", () => {
  __vite_ssr_identity__(__vite_ssr_import_0__.expect)(__vite_ssr_identity__(__vite_ssr_import_3__.default)).toBeTruthy();
  const wrapper = __vite_ssr_identity__(__vite_ssr_import_1__.mount)(__vite_ssr_identity__(__vite_ssr_import_3__.default));
  __vite_ssr_identity__(__vite_ssr_import_0__.expect)(wrapper.text()).toContain("hello");
});
__vite_ssr_identity__(__vite_ssr_import_0__.test)("vue non-SFC, uses query parameters in file imports", async () => {
  const wrapper = __vite_ssr_identity__(__vite_ssr_import_1__.mount)(__vite_ssr_identity__(__vite_ssr_import_4__.CounterVue));
  await wrapper.find("button").trigger("click");
  __vite_ssr_identity__(__vite_ssr_import_0__.expect)(wrapper.text()).contain(1);
});

//# sourceMappingSource=vite-node
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBQUEsQ0FBQTs7Ozs7O0FBSWlDO0FBQ1g7QUFDSjtBQUNFO0FBQ087c0JBRTNCLDRCQUFLLGtCQUFrQixZQUFZO0FBQ2pDLDRFQUFPLDhCQUFLLEVBQUUsV0FBVztBQUV6QixRQUFNLGdDQUFVLG1EQUFNLGdDQUFPO0FBQUEsSUFDM0IsT0FBTztBQUFBLE1BQ0wsT0FBTztBQUFBLElBQ1Q7QUFBQSxFQUNGLENBQUM7QUFFRCxzREFBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLFVBQVUsV0FBVztBQUM1QyxzREFBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLHNCQUFzQjtBQUFBO0FBQUE7QUFBQSxHQUc1QztBQUVELFFBQU0sUUFBUSxJQUFJLFFBQVEsRUFBRSxRQUFRLE9BQU87QUFFM0MsUUFBTSx5QkFBRyxRQUFRLE1BQU07QUFDckIsd0RBQU8sUUFBUSxLQUFLLENBQUMsRUFBRSxVQUFVLFlBQVk7QUFBQSxFQUMvQyxDQUFDO0FBRUQsUUFBTSxRQUFRLElBQUksUUFBUSxFQUFFLFFBQVEsT0FBTztBQUUzQyxRQUFNLHlCQUFHLFFBQVEsTUFBTTtBQUNyQix3REFBTyxRQUFRLEtBQUssQ0FBQyxFQUFFLFVBQVUsWUFBWTtBQUFBLEVBQy9DLENBQUM7QUFDSCxDQUFDO3NCQUVELDRCQUFLLHdCQUF3QixNQUFNO0FBQ2pDLDRFQUFPLDhCQUFPLEVBQUUsV0FBVztBQUUzQixRQUFNLGdDQUFVLG1EQUFNLDhCQUFPO0FBRTdCLHNEQUFPLFFBQVEsS0FBSyxDQUFDLEVBQUUsVUFBVSxPQUFPO0FBQzFDLENBQUM7c0JBRUQsNEJBQUssc0RBQXNELFlBQVk7QUFDckUsUUFBTSxnQ0FBVSxtREFBTSxpQ0FBVTtBQUVoQyxRQUFNLFFBQVEsS0FBSyxRQUFRLEVBQUUsUUFBUSxPQUFPO0FBQzVDLHNEQUFPLFFBQVEsS0FBSyxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ2xDLENBQUMiLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbInZ1ZS1maXh0dXJlLnRlc3QudHMiXSwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBAdml0ZXN0LWVudmlyb25tZW50IGhhcHB5LWRvbVxuICovXG5cbmltcG9ydCB7IGV4cGVjdCwgdGVzdCwgdmkgfSBmcm9tICd2aXRlc3QnXG5pbXBvcnQgeyBtb3VudCB9IGZyb20gJ0B2dWUvdGVzdC11dGlscydcbmltcG9ydCBIZWxsbyBmcm9tICcuLi9zcmMvVnVlL0hlbGxvLnZ1ZSdcbmltcG9ydCBEZWZpbmVkIGZyb20gJy4uL3NyYy9WdWUvRGVmaW5lZC52dWUnXG5pbXBvcnQgeyBDb3VudGVyVnVlIH0gZnJvbSAnLi4vc3JjL1Z1ZS9Db3VudGVyJ1xuXG50ZXN0KCd2dWUgMyBjb3ZlcmFnZScsIGFzeW5jICgpID0+IHtcbiAgZXhwZWN0KEhlbGxvKS50b0JlVHJ1dGh5KClcblxuICBjb25zdCB3cmFwcGVyID0gbW91bnQoSGVsbG8sIHtcbiAgICBwcm9wczoge1xuICAgICAgY291bnQ6IDQsXG4gICAgfSxcbiAgfSlcblxuICBleHBlY3Qod3JhcHBlci50ZXh0KCkpLnRvQ29udGFpbignNCB4IDIgPSA4JylcbiAgZXhwZWN0KHdyYXBwZXIuaHRtbCgpKS50b01hdGNoSW5saW5lU25hcHNob3QoYFxuICAgIFwiPGRpdj40IHggMiA9IDg8L2Rpdj5cbiAgICA8YnV0dG9uPiB4MSA8L2J1dHRvbj5cIlxuICBgKVxuXG4gIGF3YWl0IHdyYXBwZXIuZ2V0KCdidXR0b24nKS50cmlnZ2VyKCdjbGljaycpXG5cbiAgYXdhaXQgdmkud2FpdEZvcigoKSA9PiB7XG4gICAgZXhwZWN0KHdyYXBwZXIudGV4dCgpKS50b0NvbnRhaW4oJzQgeCAzID0gMTInKVxuICB9KVxuXG4gIGF3YWl0IHdyYXBwZXIuZ2V0KCdidXR0b24nKS50cmlnZ2VyKCdjbGljaycpXG5cbiAgYXdhaXQgdmkud2FpdEZvcigoKSA9PiB7XG4gICAgZXhwZWN0KHdyYXBwZXIudGV4dCgpKS50b0NvbnRhaW4oJzQgeCA0ID0gMTYnKVxuICB9KVxufSlcblxudGVzdCgnZGVmaW5lIHBhY2thZ2UgaW4gdm0nLCAoKSA9PiB7XG4gIGV4cGVjdChEZWZpbmVkKS50b0JlVHJ1dGh5KClcblxuICBjb25zdCB3cmFwcGVyID0gbW91bnQoRGVmaW5lZClcblxuICBleHBlY3Qod3JhcHBlci50ZXh0KCkpLnRvQ29udGFpbignaGVsbG8nKVxufSlcblxudGVzdCgndnVlIG5vbi1TRkMsIHVzZXMgcXVlcnkgcGFyYW1ldGVycyBpbiBmaWxlIGltcG9ydHMnLCBhc3luYyAoKSA9PiB7XG4gIGNvbnN0IHdyYXBwZXIgPSBtb3VudChDb3VudGVyVnVlKVxuXG4gIGF3YWl0IHdyYXBwZXIuZmluZCgnYnV0dG9uJykudHJpZ2dlcignY2xpY2snKVxuICBleHBlY3Qod3JhcHBlci50ZXh0KCkpLmNvbnRhaW4oMSlcbn0pXG4iXSwiZmlsZSI6Ii9ob21lL2hpcm9zaGkvY29kZS9vdGhlcnMvdml0ZXN0L3Rlc3QvY292ZXJhZ2UtdGVzdC9maXh0dXJlcy90ZXN0L3Z1ZS1maXh0dXJlLnRlc3QudHMifQ==
