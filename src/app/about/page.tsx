import Link from "next/link";

export default function AboutPage() {
  return (
    <main className="site-page">
      <header className="site-header">
        <Link className="product-link" href="/">
          <span className="product-mark" aria-hidden="true">S</span>
          <span>Side-by-Side Bible</span>
        </Link>
        <nav aria-label="Site">
          <Link href="/read/JHN/1">Reader</Link>
          <Link href="/settings">Settings</Link>
        </nav>
      </header>
      <article className="about-content">
        <div className="page-intro">
          <span className="eyebrow">About</span>
          <h1>Read the differences without losing the verse.</h1>
          <p>
            Side-by-Side Bible aligns translations to a common canonical row,
            making comparison calm, direct, and readable.
          </p>
        </div>

        <section>
          <h2>Text sources</h2>
          <p>
            English text is supplied at reading time by API.Bible, the ESV API,
            and Living Stream Ministry’s Recovery Version service. Each reader
            column displays the attribution returned with that text.
          </p>
          <p>
            The Original selection displays Hebrew from the Open Scriptures
            Hebrew Bible in the Old Testament and Greek from the Open Greek New
            Testament in the New Testament.
          </p>
          <ul className="source-list">
            <li>
              <a href="https://scripture.api.bible/" rel="noreferrer" target="_blank">
                API.Bible
              </a>
              <span>NASB, NKJV, and NIV where account entitlements permit.</span>
            </li>
            <li>
              <a href="https://api.esv.org/" rel="noreferrer" target="_blank">
                ESV API
              </a>
              <span>English Standard Version.</span>
            </li>
            <li>
              <a href="https://text.recoveryversion.bible/" rel="noreferrer" target="_blank">
                Recovery Version
              </a>
              <span>Living Stream Ministry service.</span>
            </li>
            <li>
              <a href="https://github.com/openscriptures/morphhb" rel="noreferrer" target="_blank">
                Open Scriptures Hebrew Bible
              </a>
              <span>OSHB, licensed CC BY 4.0.</span>
            </li>
            <li>
              <a href="https://github.com/eliranwong/OpenGNT" rel="noreferrer" target="_blank">
                Open Greek New Testament
              </a>
              <span>OGNT by Eliran Wong, licensed CC BY-SA 4.0.</span>
            </li>
          </ul>
        </section>

        <section>
          <h2>Storage and use boundaries</h2>
          <p>
            Scripture is requested one chapter at a time. The browser keeps
            only a small, temporary in-memory set of recent chapters and never
            writes Scripture text to local or session storage. Those stores
            contain only reader preferences and anonymous IDs required for
            API.Bible display reporting.
          </p>
          <p>
            This reader does not provide bulk download, export, offline, or
            redistribution features. Translation copyrights and provider terms
            continue to apply to all displayed text.
          </p>
        </section>
      </article>
    </main>
  );
}
