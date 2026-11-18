"use client";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <main className="public-shell">
      <section className="public-asset-card public-unavailable">
        <h1>Asset information unavailable</h1>
        <p>The record could not be loaded. Please try again shortly.</p>
        <button className="btn-secondary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
