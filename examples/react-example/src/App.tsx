import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="container">
      <header className="header">
        <h1>click-to-source Demo</h1>
        <p className="subtitle">
          Try Ctrl+clicking on any element below to open its source in VSCode
        </p>
      </header>

      <main className="main">
        <section className="card">
          <h2>Welcome 👋</h2>
          <p>
            This is a demonstration of the{' '}
            <strong>click-to-source</strong> development tool. With it enabled,
            you can Ctrl+Click any element to instantly jump to its source code
            in VSCode.
          </p>
        </section>

        <section className="card">
          <h2>Counter Example</h2>
          <p>Click count: {count}</p>
          <button onClick={() => setCount(count + 1)} className="button">
            Increment Counter
          </button>
          <button onClick={() => setCount(0)} className="button secondary">
            Reset
          </button>
        </section>

        <section className="card">
          <h2>Element Inspector</h2>
          <p>Try Ctrl+clicking on these elements:</p>
          <ul>
            <li>This list item</li>
            <li>Another list item</li>
            <li>And this one too!</li>
          </ul>
        </section>

        <section className="card">
          <h2>Settings</h2>
          <p>
            Click the floating button in the bottom-right corner to customize:
          </p>
          <ul>
            <li>🔑 Hotkey (Ctrl, Alt, Meta, Shift)</li>
            <li>📍 Button position (corners)</li>
            <li>🎨 Theme (Light, Dark, Auto)</li>
            <li>🎛️ Enable/Disable</li>
          </ul>
        </section>

        <section className="card">
          <h2>How It Works</h2>
          <p>
            The Babel plugin automatically adds source information to every JSX
            element during development. When you Ctrl+Click, the source file
            opens in VSCode at the exact line and column.
          </p>
          <code>data-click-to-source="/src/App.tsx:42:14"</code>
        </section>
      </main>

      <footer className="footer">
        <p>Made with ❤️ for better development experience</p>
      </footer>
    </div>
  )
}

export default App
