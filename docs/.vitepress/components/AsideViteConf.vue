<template>
  <a
    class="viteconf"
    href="https://viteconf.org/?utm=vitest-sidebar"
    target="_blank"
  >
    <img width="22" height="22" src="/viteconf.svg">
    <span>
      <p class="extra-info">Building Together</p>
      <p class="heading">ViteConf 24 - Oct 3</p>
      <p class="extra-info">Get your free ticket!</p>
    </span>
  </a>
</template>

<style scoped>
.viteconf {
  margin-top: 1rem;
  margin-bottom: 1rem;
  border-radius: 14px;
  padding-top: 0.4rem;
  padding-bottom: 0.4rem;
  position: relative;
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 1rem;
  background-color: var(--vp-c-bg-soft);
  border: 2px solid var(--vp-c-bg-soft);
  transition: border-color 0.5s;
  filter: grayscale(1);
}
.viteconf:hover {
  border: 2px solid #9499ff;
  filter: none;
}
.viteconf img {
  transition: transform 0.5s;
  transform: scale(1.25);
}
.viteconf:hover img {
  transform: scale(1.75);
}

.viteconf .heading {
  color: var(--vt-c-text-1);
}
.viteconf:hover .heading {
  background-image: linear-gradient(
    120deg,
    #b047ff 16%,
    #9499ff,
    #9499ff
  );
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.viteconf .extra-info {
  color: var(--vp-c-text-1);
  opacity: 0;
  font-size: 0.7rem;
  padding-left: 0.1rem;
  transition: opacity 0.5s;
}
.viteconf:hover .extra-info {
  opacity: 0.9;
}
</style>
