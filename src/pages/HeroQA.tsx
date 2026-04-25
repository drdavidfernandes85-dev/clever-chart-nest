import { useState } from "react";

const BREAKPOINTS = [
  { label: "Mobile", width: 390, height: 844, icon: "📱" },
  { label: "Tablet", width: 820, height: 1180, icon: "💻" },
  { label: "Desktop", width: 1440, height: 900, icon: "🖥️" },
] as const;

/**
 * Dev-only QA route to preview the hero across breakpoints simultaneously.
 * Each iframe loads "/" so any HeroSection edits update live.
 */
const HeroQA = () => {
  const [showGrid, setShowGrid] = useState(false);
  const [scale, setScale] = useState(0.5);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Toolbar */}
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-950/90 px-6 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold uppercase tracking-[0.2em] text-primary">
            Hero QA
          </span>
          <span className="text-xs text-zinc-500">
            Live preview across breakpoints
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-2">
            <span className="text-zinc-400">Zoom</span>
            <input
              type="range"
              min={0.25}
              max={1}
              step={0.05}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="h-1 w-32 accent-primary"
            />
            <span className="w-10 tabular-nums text-zinc-300">
              {Math.round(scale * 100)}%
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showGrid}
              onChange={(e) => setShowGrid(e.target.checked)}
              className="accent-primary"
            />
            <span className="text-zinc-400">Overlay grid</span>
          </label>
          <button
            onClick={() => window.location.reload()}
            className="rounded border border-zinc-700 px-2 py-1 text-zinc-300 hover:border-primary hover:text-primary"
          >
            ↻ Reload
          </button>
        </div>
      </header>

      {/* Frames */}
      <div className="flex flex-wrap items-start gap-8 p-8">
        {BREAKPOINTS.map(({ label, width, height, icon }) => {
          const scaledW = width * scale;
          const scaledH = height * scale;
          return (
            <div key={label} className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-400">
                <span>{icon}</span>
                <span className="font-semibold text-zinc-200">{label}</span>
                <span className="tabular-nums text-zinc-500">
                  {width}×{height}
                </span>
              </div>
              <div
                className="relative overflow-hidden rounded-xl border border-zinc-800 bg-black shadow-[0_0_60px_hsl(45_100%_50%/0.08)]"
                style={{ width: scaledW, height: scaledH }}
              >
                <iframe
                  src="/"
                  title={`hero-${label}`}
                  width={width}
                  height={height}
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    border: 0,
                  }}
                />
                {showGrid && (
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage:
                        "linear-gradient(hsl(45 100% 50% / 0.15) 1px, transparent 1px), linear-gradient(90deg, hsl(45 100% 50% / 0.15) 1px, transparent 1px)",
                      backgroundSize: `${64 * scale}px ${64 * scale}px`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* QA checklist */}
      <section className="mx-auto max-w-3xl px-8 pb-16">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">
          Visual checks
        </h2>
        <ul className="space-y-2 text-sm text-zinc-300">
          <li className="flex items-start gap-2">
            <span className="text-primary">✦</span>
            Comet trail flows from left into the logo without clipping at any
            width.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✦</span>
            Logo halo pulses smoothly (no jitter / layout shift while
            <code className="mx-1 rounded bg-zinc-800 px-1">animate-pulse-glow</code>
            runs).
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✦</span>
            Spark particles stay inside the hero container — no overflow into
            navbar or next section.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">✦</span>
            Title, CTA and countdown remain legible over the readability mask
            on every breakpoint.
          </li>
        </ul>
      </section>
    </div>
  );
};

export default HeroQA;
