<template>
  <main class="nuxt-shell">
    <h1>Nuxt Demo</h1>
    <p>Use the hotkey and click this Nuxt page.</p>
    <button type="button" @click="count += 1">Clicked {{ count }} times</button>
  </main>
</template>

<script setup lang="ts">
const count = ref(0);
</script>

<style scoped>
.nuxt-shell {
  display: grid;
  gap: 12px;
  padding: 24px;
}
</style>
