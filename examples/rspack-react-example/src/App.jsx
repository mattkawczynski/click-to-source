import React, { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app-shell">
      <header className="stack">
        <p className="eyebrow">Rspack React</p>
        <h1>click-to-source example</h1>
        <p>Hold the configured hotkey and click the cards, buttons, and list items below.</p>
      </header>

      <section className="card stack">
        <h2>Counter</h2>
        <p>Current count: {count}</p>
        <div className="actions">
          <button type="button" onClick={() => setCount((value) => value + 1)}>
            Increment
          </button>
          <button type="button" onClick={() => setCount(0)}>
            Reset
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>Inspector targets</h2>
        <ul>
          <li>Card label</li>
          <li>Status paragraph</li>
          <li>Button text</li>
        </ul>
      </section>
    </main>
  );
}
