"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <p className="eyebrow">IC ATLAS</p>
      <h1>We couldn’t open your collection.</h1>
      <p>
        Please check that the app can write to its data directory, then try
        again.
      </p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
