export function Footer() {
  return (
    <footer className="mt-auto px-4 sm:px-6 py-6 text-[11px] text-ink-400 border-t border-ink-800/80">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div>Matchboxd · built from your public Letterboxd taste.</div>
          <div className="mt-1 text-ink-500">
            Not affiliated with Letterboxd. Reads public profile pages only.
          </div>
        </div>
        <div className="flex items-center gap-3 text-ink-500">
          <a
            href="https://letterboxd.com"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-200 transition-colors"
          >
            Letterboxd
          </a>
          <span aria-hidden>·</span>
          <a
            href="https://www.justwatch.com/tr"
            target="_blank"
            rel="noreferrer"
            className="hover:text-ink-200 transition-colors"
          >
            JustWatch TR
          </a>
        </div>
      </div>
    </footer>
  );
}
