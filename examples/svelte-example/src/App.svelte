<script>
  let count = 0;
</script>

<main class="app-shell">
  <h1>Svelte Smoke Test</h1>
  <p>Hold the configured hotkey and click this paragraph to jump to App.svelte.</p>
  <button type="button" on:click={() => count += 1}>Clicked {count} times</button>
</main>

<style>
  .app-shell {
    font-family: sans-serif;
    display: grid;
    gap: 12px;
    padding: 24px;
  }
</style>
