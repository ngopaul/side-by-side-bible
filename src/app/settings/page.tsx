import Link from "next/link";
import { Suspense } from "react";

import { SettingsForm } from "@/components/settings-form";

export default function SettingsPage() {
  return (
    <main className="site-page">
      <header className="site-header">
        <Link className="product-link" href="/">
          <span className="product-mark" aria-hidden="true">S</span>
          <span>Side-by-Side Bible</span>
        </Link>
        <nav aria-label="Site">
          <Link href="/read/JHN/1">Reader</Link>
          <Link href="/about">About</Link>
        </nav>
      </header>
      <div className="page-intro">
        <span className="eyebrow">Preferences</span>
        <h1>Shape your reading space</h1>
        <p>
          Keep the comparison focused. These choices stay only in this
          browser.
        </p>
      </div>
      <Suspense fallback={<div className="settings-loading">Loading preferences…</div>}>
        <SettingsForm />
      </Suspense>
    </main>
  );
}
