export default function HomePage() {
  const items = ["Catalog", "Checkout"] as const;

  return (
    <main className="page-shell">
      <h1>Next App Router Demo</h1>
      <p>Use the hotkey and click this App Router page.</p>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </main>
  );
}
