/**
 * Ambient background: three slow-drifting colour fields over a faint grid.
 *
 * Deliberately pure CSS — no canvas, no WebGL, no extra dependency — so it
 * costs nothing at runtime and disappears entirely under
 * `prefers-reduced-motion`.
 */
export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-ink-950" />

      <div className="absolute -left-[15%] -top-[20%] h-[55vw] w-[55vw] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(129,140,248,0.30),transparent_62%)] blur-3xl" />
      <div className="absolute -right-[12%] top-[6%] h-[48vw] w-[48vw] animate-aurora-slow rounded-full bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.22),transparent_62%)] blur-3xl" />
      <div className="absolute bottom-[-25%] left-[22%] h-[52vw] w-[52vw] animate-aurora rounded-full bg-[radial-gradient(circle_at_center,rgba(167,139,250,0.24),transparent_64%)] blur-3xl" />

      <div className="grid-bg absolute inset-0 opacity-[0.55]" />

      {/* Vignette keeps text contrast high over the bright blobs. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(6,6,10,0.85)_100%)]" />
    </div>
  );
}
