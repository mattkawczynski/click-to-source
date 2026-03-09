<template>
  <main class="app-shell">
    <h1>Vue Smoke Test</h1>
    <p>Hold the configured hotkey and click this paragraph to jump to App.vue.</p>
    <button type="button" @click="count += 1">Clicked {{ count }} times</button>
  </main>
</template>

<script setup lang="ts">
import { ref } from "vue";

const count = ref(0);
</script>

<style scoped>
.app-shell {
  font-family: sans-serif;
  display: grid;
  gap: 12px;
  padding: 24px;
}
</style>
