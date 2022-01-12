<template>
  <div p-2 text-center inline-block>
    <div text-4xl>
      <slot name="body" />
    </div>
    <div text-md>
      <slot name="header" />
    </div>
  </div>
</template>
