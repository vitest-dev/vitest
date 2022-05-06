// vite.config.ts
import { resolve } from 'pathe'
import { defineConfig } from 'vite'
import Vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Unocss from 'unocss/vite'
import Pages from 'vite-plugin-pages'
import { presetAttributify, presetIcons, presetUno } from 'unocss'
import OptimizationPersist from 'vite-plugin-optimize-persist'
import PkgConfig from 'vite-plugin-package-config'
const config = {
  root: '/Users/antoine/Code/vitest/packages/ui',
  base: '/__vitest__/',
  resolve: {
    alias: {
      '~/': `${resolve('/Users/antoine/Code/vitest/packages/ui', 'client')}/`,
      '@vitest/ws-client': `${resolve('/Users/antoine/Code/vitest/packages/ui', '../ws-client/src/index.ts')}`,
    },
  },
  plugins: [
    Vue(),
    Unocss({
      presets: [
        presetUno(),
        presetAttributify(),
        presetIcons(),
      ],
      shortcuts: {
        'bg-base': 'bg-white dark:bg-[#111]',
        'bg-overlay': 'bg-[#eee]:50 dark:bg-[#222]:50',
        'bg-header': 'bg-gray-500:5',
        'bg-active': 'bg-gray-500:8',
        'bg-hover': 'bg-gray-500:20',
        'border-base': 'border-gray-500:10',
        'tab-button': 'font-light op50 hover:op80 h-full px-4',
        'tab-button-active': 'op100 bg-gray-500:10',
      },
    }),
    Components({
      dirs: ['client/components'],
      dts: resolve('/Users/antoine/Code/vitest/packages/ui', './client/components.d.ts'),
    }),
    Pages({
      dirs: ['client/pages'],
    }),
    AutoImport({
      dts: resolve('/Users/antoine/Code/vitest/packages/ui', './client/auto-imports.d.ts'),
      imports: [
        'vue',
        'vue-router',
        '@vueuse/core',
      ],
    }),
    PkgConfig.default(),
    OptimizationPersist.default(),
  ],
  build: {
    outDir: './dist/client',
  },
  optimizeDeps: {
    include: [
      'vue',
    ],
  },
}
const vite_config_default = defineConfig(config)
export {
  config,
  vite_config_default as default,
}
// # sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImltcG9ydCB7IHJlc29sdmUgfSBmcm9tICdwYXRoZSdcbmltcG9ydCB0eXBlIHsgVXNlckNvbmZpZyB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IFZ1ZSBmcm9tICdAdml0ZWpzL3BsdWdpbi12dWUnXG5pbXBvcnQgQ29tcG9uZW50cyBmcm9tICd1bnBsdWdpbi12dWUtY29tcG9uZW50cy92aXRlJ1xuaW1wb3J0IEF1dG9JbXBvcnQgZnJvbSAndW5wbHVnaW4tYXV0by1pbXBvcnQvdml0ZSdcbmltcG9ydCBVbm9jc3MgZnJvbSAndW5vY3NzL3ZpdGUnXG5pbXBvcnQgUGFnZXMgZnJvbSAndml0ZS1wbHVnaW4tcGFnZXMnXG5pbXBvcnQgeyBwcmVzZXRBdHRyaWJ1dGlmeSwgcHJlc2V0SWNvbnMsIHByZXNldFVubyB9IGZyb20gJ3Vub2NzcydcbmltcG9ydCBPcHRpbWl6YXRpb25QZXJzaXN0IGZyb20gJ3ZpdGUtcGx1Z2luLW9wdGltaXplLXBlcnNpc3QnXG5pbXBvcnQgUGtnQ29uZmlnIGZyb20gJ3ZpdGUtcGx1Z2luLXBhY2thZ2UtY29uZmlnJ1xuXG5leHBvcnQgY29uc3QgY29uZmlnOiBVc2VyQ29uZmlnID0ge1xuICByb290OiBcIi9Vc2Vycy9hbnRvaW5lL0NvZGUvdml0ZXN0L3BhY2thZ2VzL3VpXCIsXG4gIGJhc2U6ICcvX192aXRlc3RfXy8nLFxuICByZXNvbHZlOiB7XG4gICAgYWxpYXM6IHtcbiAgICAgICd+Lyc6IGAke3Jlc29sdmUoXCIvVXNlcnMvYW50b2luZS9Db2RlL3ZpdGVzdC9wYWNrYWdlcy91aVwiLCAnY2xpZW50Jyl9L2AsXG4gICAgICAnQHZpdGVzdC93cy1jbGllbnQnOiBgJHtyZXNvbHZlKFwiL1VzZXJzL2FudG9pbmUvQ29kZS92aXRlc3QvcGFja2FnZXMvdWlcIiwgJy4uL3dzLWNsaWVudC9zcmMvaW5kZXgudHMnKX1gLFxuICAgIH0sXG4gIH0sXG4gIHBsdWdpbnM6IFtcbiAgICBWdWUoKSxcbiAgICBVbm9jc3Moe1xuICAgICAgcHJlc2V0czogW1xuICAgICAgICBwcmVzZXRVbm8oKSxcbiAgICAgICAgcHJlc2V0QXR0cmlidXRpZnkoKSxcbiAgICAgICAgcHJlc2V0SWNvbnMoKSxcbiAgICAgIF0sXG4gICAgICBzaG9ydGN1dHM6IHtcbiAgICAgICAgJ2JnLWJhc2UnOiAnYmctd2hpdGUgZGFyazpiZy1bIzExMV0nLFxuICAgICAgICAnYmctb3ZlcmxheSc6ICdiZy1bI2VlZV06NTAgZGFyazpiZy1bIzIyMl06NTAnLFxuICAgICAgICAnYmctaGVhZGVyJzogJ2JnLWdyYXktNTAwOjUnLFxuICAgICAgICAnYmctYWN0aXZlJzogJ2JnLWdyYXktNTAwOjgnLFxuICAgICAgICAnYmctaG92ZXInOiAnYmctZ3JheS01MDA6MjAnLFxuICAgICAgICAnYm9yZGVyLWJhc2UnOiAnYm9yZGVyLWdyYXktNTAwOjEwJyxcblxuICAgICAgICAndGFiLWJ1dHRvbic6ICdmb250LWxpZ2h0IG9wNTAgaG92ZXI6b3A4MCBoLWZ1bGwgcHgtNCcsXG4gICAgICAgICd0YWItYnV0dG9uLWFjdGl2ZSc6ICdvcDEwMCBiZy1ncmF5LTUwMDoxMCcsXG4gICAgICB9LFxuICAgIH0pLFxuICAgIENvbXBvbmVudHMoe1xuICAgICAgZGlyczogWydjbGllbnQvY29tcG9uZW50cyddLFxuICAgICAgZHRzOiByZXNvbHZlKFwiL1VzZXJzL2FudG9pbmUvQ29kZS92aXRlc3QvcGFja2FnZXMvdWlcIiwgJy4vY2xpZW50L2NvbXBvbmVudHMuZC50cycpLFxuICAgIH0pLFxuICAgIFBhZ2VzKHtcbiAgICAgIGRpcnM6IFsnY2xpZW50L3BhZ2VzJ10sXG4gICAgfSksXG4gICAgQXV0b0ltcG9ydCh7XG4gICAgICBkdHM6IHJlc29sdmUoXCIvVXNlcnMvYW50b2luZS9Db2RlL3ZpdGVzdC9wYWNrYWdlcy91aVwiLCAnLi9jbGllbnQvYXV0by1pbXBvcnRzLmQudHMnKSxcbiAgICAgIGltcG9ydHM6IFtcbiAgICAgICAgJ3Z1ZScsXG4gICAgICAgICd2dWUtcm91dGVyJyxcbiAgICAgICAgJ0B2dWV1c2UvY29yZScsXG4gICAgICBdLFxuICAgIH0pLFxuICAgIC8vIEB0cy1leHBlY3QtZXJyb3IgVW5zdXJlIHdoeSB0aGlzIGlzIG5vdCB3b3JraW5nIC0tIGl0J3Mgd2hhdCB0aGUgZG9jdW1lbnRhdGlvbiBzYXlzIHRvIGRvXG4gICAgUGtnQ29uZmlnLmRlZmF1bHQoKSxcbiAgICAvLyBAdHMtZXhwZWN0LWVycm9yIFVuc3VyZSB3aHkgdGhpcyBpcyBub3Qgd29ya2luZyAtLSBpdCdzIHdoYXQgdGhlIGRvY3VtZW50YXRpb24gc2F5cyB0byBkb1xuICAgIE9wdGltaXphdGlvblBlcnNpc3QuZGVmYXVsdCgpLFxuICBdLFxuICBidWlsZDoge1xuICAgIG91dERpcjogJy4vZGlzdC9jbGllbnQnLFxuICB9LFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBpbmNsdWRlOiBbXG4gICAgICAndnVlJyxcbiAgICBdLFxuICB9LFxufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoY29uZmlnKVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBO0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBRU8sSUFBTSxTQUFxQjtBQUFBLEVBQ2hDLE1BQU07QUFBQSxFQUNOLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLE1BQU0sR0FBRyxRQUFRLDBDQUEwQyxRQUFRO0FBQUEsTUFDbkUscUJBQXFCLEdBQUcsUUFBUSwwQ0FBMEMsMkJBQTJCO0FBQUEsSUFDdkc7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxJQUFJO0FBQUEsSUFDSixPQUFPO0FBQUEsTUFDTCxTQUFTO0FBQUEsUUFDUCxVQUFVO0FBQUEsUUFDVixrQkFBa0I7QUFBQSxRQUNsQixZQUFZO0FBQUEsTUFDZDtBQUFBLE1BQ0EsV0FBVztBQUFBLFFBQ1QsV0FBVztBQUFBLFFBQ1gsY0FBYztBQUFBLFFBQ2QsYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2IsWUFBWTtBQUFBLFFBQ1osZUFBZTtBQUFBLFFBRWYsY0FBYztBQUFBLFFBQ2QscUJBQXFCO0FBQUEsTUFDdkI7QUFBQSxJQUNGLENBQUM7QUFBQSxJQUNELFdBQVc7QUFBQSxNQUNULE1BQU0sQ0FBQyxtQkFBbUI7QUFBQSxNQUMxQixLQUFLLFFBQVEsMENBQTBDLDBCQUEwQjtBQUFBLElBQ25GLENBQUM7QUFBQSxJQUNELE1BQU07QUFBQSxNQUNKLE1BQU0sQ0FBQyxjQUFjO0FBQUEsSUFDdkIsQ0FBQztBQUFBLElBQ0QsV0FBVztBQUFBLE1BQ1QsS0FBSyxRQUFRLDBDQUEwQyw0QkFBNEI7QUFBQSxNQUNuRixTQUFTO0FBQUEsUUFDUDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLElBRUQsVUFBVSxRQUFRO0FBQUEsSUFFbEIsb0JBQW9CLFFBQVE7QUFBQSxFQUM5QjtBQUFBLEVBQ0EsT0FBTztBQUFBLElBQ0wsUUFBUTtBQUFBLEVBQ1Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVM7QUFBQSxNQUNQO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRjtBQUVBLElBQU8sc0JBQVEsYUFBYSxNQUFNOyIsCiAgIm5hbWVzIjogW10KfQo=
