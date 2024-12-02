<template>
  <div class="old-document">
    <p>
      This documentation covers Vitest 1 <strong>(old version)</strong>. For the
      latest version, see
      <a href="https://vitest.dev" class="new-document-link">https://vitest.dev</a>.
    </p>
  </div>
</template>

<style>
.old-document {
  position: fixed;
  top: 0;
  left: 0;
  display: flex;
  height: var(--vp-layout-top-height);
  width: 100%;
  padding: 4px 32px;
  justify-content: center;
  align-items: center;
  color: var(--vp-c-text-1);
  background: var(--vp-c-brand-softest);
  z-index: calc(var(--vp-z-index-nav) + 1);
  .new-document-link {
    text-decoration: underline;
  }
}
</style>
