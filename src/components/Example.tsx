import type { JSX } from "react";

export default function Examples(): JSX.Element {
  return <div><h1>Demo: Screen Reader Simulator (Silktide-like)</h1>
      <p>Press <kbd>J</kbd>/<kbd>K</kbd> to move; <kbd>H</kbd>/<kbd>R</kbd>/<kbd>F</kbd>/<kbd>L</kbd>/<kbd>T</kbd>/<kbd>G</kbd> to filter; <kbd>;</kbd> to read-all; <kbd>S</kbd> to stop; <kbd>C</kbd> curtain.</p>

      <nav aria-label="Primary">
        <a href="#a">Home</a> | <a href="#b">Docs</a> | <a href="#c">Contact</a>
      </nav>

      <section aria-labelledby="features-h">
        <h2 id="features-h">Features</h2>
        <button aria-pressed="false">Toggle</button>
        <button aria-pressed="true">Pinned</button>
        <div role="region" aria-label="Widget area">
          <a href="#x" aria-label="Read more about widgets">Widgets</a>
        </div>
      </section>

      <section>
        <h2>Form</h2>
        <label>
          Name
          <input placeholder="Full name" />
        </label>
        <label>
          Subscribe
          <input type="checkbox" />
        </label>
        <div aria-live="polite" id="status">Status messages appear here.</div>
        <button onClick={() => { const el = document.getElementById("status"); if (el) el.textContent = `Saved at ${new Date().toLocaleTimeString()}`; }}>Save</button>
      </section>

      <section>
        <h2>Table</h2>
        <table>
          <thead><tr><th>Col A</th><th>Col B</th></tr></thead>
          <tbody>
            <tr><td>Row 1 A</td><td>Row 1 B</td></tr>
            <tr><td>Row 2 A</td><td>Row 2 B</td></tr>
          </tbody>
        </table>
      </section>

      <section>
        <h2>Graphics</h2>
        <img src="https://via.placeholder.com/80" alt="Placeholder graphic" />
      </section></div>
}
