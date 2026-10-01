export function Brand({ light = false }: { light?: boolean }) {
  return (
    <div className={`brand${light ? " brand-light" : ""}`}>
      <svg viewBox="0 0 40 44" fill="none" aria-hidden="true">
        <path d="M7 38V20a13 13 0 0 1 26 0v18M15 38V21a5 5 0 0 1 10 0v17M3 38h34" stroke="currentColor" strokeWidth="1.8" />
        <path d="M20 1v3M3 8l3 3M37 8l-3 3" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div><span className="brand-name">StayLedger<span className="brand-dot">.</span></span><span className="brand-caption">THE ART OF HOSTING, SIMPLIFIED</span></div>
    </div>
  );
}
