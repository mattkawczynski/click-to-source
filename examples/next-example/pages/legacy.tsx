export default function LegacyPage() {
  const details = ["Search", "Pricing"] as const;

  return (
    <main className="legacy-shell">
      <h1>Next Pages Router Demo</h1>
      <p>Use the hotkey and click this Pages Router page.</p>
      <div>
        {details.map((detail) => (
          <span key={detail}>{detail}</span>
        ))}
      </div>
    </main>
  );
}
