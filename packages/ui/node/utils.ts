export function transformCoverageEntryPoint(
  entryPoint: string,
) {
  return entryPoint.replace('</head>', `<script>
(() => {
 const theme = 'vueuse-color-scheme'
 const preference = localStorage.getItem(theme)
 const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
 if (!preference || preference === 'auto' ? prefersDark : preference === 'dark')
   document.documentElement.classList.add('dark')

 window.addEventListener('storage', (e) => {
   if (e.key === theme) {
     document.documentElement.classList.remove('dark')
     if (!e.newValue || e.newValue === 'auto' ? prefersDark : e.newValue === 'dark')
        document.documentElement.classList.add('dark')
   }
 })
})();
</script>
</head>`)
}
