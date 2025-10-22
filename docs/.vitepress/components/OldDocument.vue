<template>
  <div class="old-document">
    <p>
      This documentation covers Vitest v3 <strong>(old version)</strong>. For the
      latest version, see
      <a href="https://vitest.dev" class="new-document-link">https://vitest.dev</a>.
    </p>
  </div>
</template>

<style>
:root {
  --vp-layout-top-height: 96px;
  @media (min-width: 455px) {
    --vp-layout-top-height: 64px;
  }
  @media (min-width: 960px) {
    --vp-layout-top-height: 32px;
  }
}

.old-document {
  position: fixed;
  display: flex;
  height: var(--vp-layout-top-height);
  width: 100%;
  padding: 4px 32px;
  justify-content: center;
  align-items: center;
  color: var(--vp-c-old-document-text);
  background: var(--vp-c-old-document-bg);
  z-index: var(--vp-z-index-layout-top);

  .new-document-link {
    text-decoration: underline;
    color: var(--vp-c-text-1);
    &:hover {
      color: var(--vp-c-text-2);
    }
  }
}
</style>
