export default function DemoCard() {
  const items = ["Preview", "Share"] as const;

  return (
    <main className="astro-shell">
      <h1>Astro Demo</h1>
      <p>Use the hotkey and click this Astro React island.</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </main>
  );
}
