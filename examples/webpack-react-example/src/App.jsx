import React, { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <main className="app-shell">
      <header className="stack">
        <p className="eyebrow">Webpack React</p>
        <h1>click-to-source example</h1>
        <p>Hold the configured hotkey and click these elements while the dev server is running.</p>
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
          <li>List item one</li>
          <li>List item two</li>
          <li>List item three</li>
        </ul>
      </section>
    </main>
  );
}
