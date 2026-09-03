<template>
  <div class="old-document">
    <p>
      This documentation covers Vitest v4 <strong>(old version)</strong>. For the
      latest version, see
      <a href="https://vitest.dev" class="new-document-link">https://vitest.dev</a>.
    </p>
  </div>
</template>

<style>
.docs-layout,
.marketing-layout {
  --vp-old-document-height: 96px;
}

@media (min-width: 455px) {
  .docs-layout,
  .marketing-layout {
    --vp-old-document-height: 64px;
  }
}

@media (min-width: 960px) {
  .docs-layout,
  .marketing-layout {
    --vp-old-document-height: 32px;
  }
}

.old-document {
  display: flex;
  height: var(--vp-old-document-height);
  width: 100%;
  padding: 4px 32px;
  justify-content: center;
  align-items: center;
  color: #2a3a1b;
  background: #f4f8e0;
  z-index: var(--vp-z-index-layout-top);
}

.dark .old-document,
[data-theme='dark'] .old-document {
  color: #c5d9b6;
  background: #2d3b2e;
}

.old-document p {
  color: inherit !important;
  font-size: 1rem !important;
  line-height: 1.75rem !important;
}

.old-document .new-document-link {
  text-decoration: underline;
  color: var(--vp-c-text-1);
}

.old-document .new-document-link:hover {
  color: var(--vp-c-text-2);
}

@media (min-width: 1024px) {
  .docs-layout:has(.old-document) {
    --vp-banner-height: var(--vp-old-document-height);
    --vp-layout-top-height: var(--vp-old-document-height);
  }

  .docs-layout .old-document {
    position: fixed;
    top: 0;
  }
}
</style>
