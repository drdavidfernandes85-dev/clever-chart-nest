import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, X, Eye, EyeOff } from "lucide-react";

type PanelReport = {
  el: HTMLElement;
  borderColor: string;
  boxShadow: string;
  hasFieryBorder: boolean;
  hasFieryGlow: boolean;
  rect: DOMRect;
  classes: string;
};

/**
 * Dev-only overlay that scans the current page for every `bg-card*` element
 * and reports whether the fiery token treatment (warm yellow border + warm
 * orange shadow halo) is actually being applied.
 *
 * Usage: <FieryThemeQA /> — renders a floating toggle bottom-right.
 * The overlay rescans on tab clicks (DOM mutations) so it works as you
 * navigate between dashboard tabs.
 */
const FieryThemeQA = () => {
  const [enabled, setEnabled] = useState(false);
  const [reports, setReports] = useState<PanelReport[]>([]);
  const [tick, setTick] = useState(0);

  // Rescan on toggle, on tab clicks, and on resize.
  useEffect(() => {
    if (!enabled) {
      setReports([]);
      return;
    }

    const scan = () => {
      const nodes = Array.from(
        document.querySelectorAll<HTMLElement>('[class*="bg-card"]')
      ).filter((el) => {
        // Skip tiny / hidden / off-screen elements
        const r = el.getBoundingClientRect();
        return r.width > 40 && r.height > 24 && r.bottom > 0 && r.top < window.innerHeight;
      });

      const results: PanelReport[] = nodes.map((el) => {
        const cs = getComputedStyle(el);
        const borderColor = cs.borderTopColor || cs.borderColor;
        const boxShadow = cs.boxShadow;

        // Heuristics for "fiery": yellow-ish border (R≈255, G≈205, B<60)
        // and a non-empty shadow with warm orange tones.
        const rgbMatch = borderColor.match(/\d+/g);
        const [r, g, b] = rgbMatch ? rgbMatch.map(Number) : [0, 0, 0];
        const hasFieryBorder = r > 200 && g > 150 && b < 80;
        const hasFieryGlow = boxShadow !== "none" && /\d+/.test(boxShadow);

        return {
          el,
          borderColor,
          boxShadow,
          hasFieryBorder,
          hasFieryGlow,
          rect: el.getBoundingClientRect(),
          classes: el.className,
        };
      });

      setReports(results);
    };

    scan();
    const onResize = () => scan();
    const onScroll = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    // Rescan on DOM changes (tab switches, drawers opening, etc.)
    const obs = new MutationObserver(() => {
      scan();
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
      obs.disconnect();
    };
  }, [enabled]);

  // Recompute rects on scroll without full rescan
  const positioned = useMemo(() => {
    if (!enabled) return [];
    return reports.map((r) => ({ ...r, rect: r.el.getBoundingClientRect() }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, enabled, tick]);

  const summary = useMemo(() => {
    const total = reports.length;
    const passing = reports.filter((r) => r.hasFieryBorder && r.hasFieryGlow).length;
    return { total, passing, failing: total - passing };
  }, [reports]);

  return (
    <>
      {/* Toggle button — fixed bottom-right */}
      <button
        type="button"
        onClick={() => setEnabled((v) => !v)}
        className="fixed bottom-4 right-4 z-[9999] inline-flex items-center gap-2 rounded-full border border-primary/40 bg-black/85 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-primary backdrop-blur-md shadow-[0_0_24px_hsl(45_100%_50%/0.35)] hover:bg-black/95 transition-colors"
        aria-label="Toggle fiery theme QA overlay"
      >
        {enabled ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        Fiery QA
        {enabled && (
          <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 font-mono text-[10px] text-primary">
            {summary.passing}/{summary.total}
          </span>
        )}
      </button>

      {/* Overlay rectangles + summary panel */}
      {enabled && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-[9990] pointer-events-none"
          >
            {positioned.map((r, i) => {
              const ok = r.hasFieryBorder && r.hasFieryGlow;
              const color = ok ? "hsl(48 100% 55%)" : "hsl(348 100% 60%)";
              return (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    left: r.rect.left,
                    top: r.rect.top,
                    width: r.rect.width,
                    height: r.rect.height,
                    border: `2px dashed ${color}`,
                    boxShadow: `inset 0 0 0 1px ${color}, 0 0 16px ${color}55`,
                    borderRadius: 8,
                  }}
                >
                  <span
                    className="absolute -top-5 left-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold"
                    style={{ background: color, color: "#0a0a0a" }}
                  >
                    {ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    #{i + 1}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Summary card — fixed bottom-left */}
          <div className="fixed bottom-4 left-4 z-[9999] w-80 max-h-[60vh] overflow-y-auto rounded-2xl border border-primary/30 bg-black/90 p-4 text-xs text-zinc-100 backdrop-blur-xl shadow-[0_0_40px_hsl(28_100%_50%/0.25)]">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                Fiery Theme QA
              </h3>
              <button
                onClick={() => setEnabled(false)}
                className="text-zinc-400 hover:text-zinc-100"
                aria-label="Close QA panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg border border-zinc-800 p-2">
                <div className="font-mono text-lg font-bold text-zinc-100">{summary.total}</div>
                <div className="text-[10px] uppercase text-zinc-500">Panels</div>
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-2">
                <div className="font-mono text-lg font-bold text-primary">{summary.passing}</div>
                <div className="text-[10px] uppercase text-primary/80">Fiery</div>
              </div>
              <div
                className="rounded-lg border p-2"
                style={{
                  borderColor: summary.failing ? "hsl(348 100% 60% / 0.4)" : "hsl(0 0% 30%)",
                  background: summary.failing ? "hsl(348 100% 60% / 0.08)" : "transparent",
                }}
              >
                <div
                  className="font-mono text-lg font-bold"
                  style={{ color: summary.failing ? "hsl(348 100% 70%)" : "hsl(0 0% 60%)" }}
                >
                  {summary.failing}
                </div>
                <div className="text-[10px] uppercase text-zinc-500">Missing</div>
              </div>
            </div>

            <p className="mb-2 text-[11px] leading-relaxed text-zinc-400">
              Scans every <code className="rounded bg-zinc-800 px-1 text-primary">bg-card*</code>{" "}
              element on the current view. Green = warm yellow border + glow shadow detected.
              Red = panel is using bg-card but missing the fiery treatment.
            </p>

            <details className="rounded-lg border border-zinc-800 p-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-zinc-300">
                Computed styles ({reports.length})
              </summary>
              <ul className="mt-2 space-y-2 text-[10px]">
                {reports.map((r, i) => (
                  <li
                    key={i}
                    className="rounded border border-zinc-800 p-2 font-mono leading-snug"
                    style={{
                      borderColor:
                        r.hasFieryBorder && r.hasFieryGlow
                          ? "hsl(48 100% 51% / 0.4)"
                          : "hsl(348 100% 60% / 0.4)",
                    }}
                  >
                    <div className="text-zinc-300">
                      #{i + 1} · {Math.round(r.rect.width)}×{Math.round(r.rect.height)}
                    </div>
                    <div className="text-zinc-500 truncate">border: {r.borderColor}</div>
                    <div className="text-zinc-500 truncate">shadow: {r.boxShadow.slice(0, 60)}…</div>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </>
      )}
    </>
  );
};

export default FieryThemeQA;
