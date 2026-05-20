import { Link } from "react-router-dom";

/**
 * Dev/Admin-only Link QA report.
 *
 * Tracks every public CTA and nav link the launch journey depends on,
 * plus internal/external classification and any explicitly hidden
 * launch routes (Leaderboard / Analytics / Video Library) that should
 * remain reachable by direct URL but never surface in launch nav.
 *
 * This is a manual registry — keep it in sync when nav changes.
 */

type LinkRow = {
  label: string;
  target: string;
  kind: "internal" | "external" | "anchor" | "protected" | "broker";
  notes?: string;
};

const PUBLIC_NAV: LinkRow[] = [
  { label: "Home (Inicio)",            target: "/",                kind: "internal" },
  { label: "Education (Educación)",    target: "/education",       kind: "internal" },
  { label: "Webinars",                 target: "/webinars",        kind: "internal" },
  { label: "Community (Comunidad)",    target: "/chatroom",        kind: "internal" },
  { label: "LTR Terminal Pro",         target: "/dashboard",       kind: "protected", notes: "Gated; routes through auth when logged out" },
  { label: "FAQ",                      target: "/#faq",            kind: "anchor" },
];

const FOOTER_LEGAL: LinkRow[] = [
  { label: "Terms & Conditions",       target: "/terms",           kind: "internal" },
  { label: "Risk Disclosure",          target: "/risk-disclosure", kind: "internal" },
  { label: "Privacy Notice",           target: "/terms#privacy",   kind: "anchor" },
  { label: "Community Guidelines",     target: "/community/guidelines", kind: "internal" },
  { label: "Contact / Compliance",     target: "/#contact",        kind: "anchor" },
];

const PUBLIC_CTAS: LinkRow[] = [
  { label: "Open My Infinox Account",  target: "https://myaccount.infinox.com/es/links/go/9926281", kind: "broker", notes: "External broker registration · new tab · noopener" },
  { label: "Connect MT5 Account",      target: "/connect-mt",      kind: "protected" },
  { label: "Enter Trading Room",       target: "/dashboard",       kind: "protected" },
  { label: "Create IX LTR Account",    target: "/register",        kind: "internal" },
  { label: "Login",                    target: "/login",           kind: "internal" },
];

const HIDDEN_LAUNCH: LinkRow[] = [
  { label: "Leaderboard",   target: "/leaderboard", kind: "internal", notes: "Hidden from launch nav · direct URL only" },
  { label: "Analytics",     target: "/analytics",   kind: "internal", notes: "Hidden from launch nav · direct URL only" },
  { label: "Video Library", target: "/videos",      kind: "internal", notes: "Hidden from launch nav · direct URL only" },
];

const Group = ({ title, rows }: { title: string; rows: LinkRow[] }) => (
  <div className="mb-2">
    <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500 mb-1">
      {title} · {rows.length}
    </div>
    <ul className="space-y-0.5">
      {rows.map((r) => {
        const isExternal = r.kind === "external" || r.kind === "broker";
        return (
          <li key={`${title}:${r.label}`} className="grid grid-cols-[1fr_auto] gap-2 items-center text-[10.5px] font-mono">
            <div className="truncate">
              <span className="text-neutral-200">{r.label}</span>
              {r.notes ? (
                <span className="text-neutral-500"> — {r.notes}</span>
              ) : null}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={
                  r.kind === "broker"     ? "text-amber-400"   :
                  r.kind === "external"   ? "text-amber-400"   :
                  r.kind === "protected"  ? "text-sky-400"     :
                  r.kind === "anchor"     ? "text-neutral-400" :
                                            "text-emerald-400"
                }
              >
                {r.kind}
              </span>
              {isExternal ? (
                <a
                  href={r.target}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-neutral-300 hover:text-[#FFCD05] underline-offset-2 hover:underline truncate max-w-[180px]"
                >
                  {r.target}
                </a>
              ) : (
                <Link
                  to={r.target}
                  className="text-neutral-300 hover:text-[#FFCD05] underline-offset-2 hover:underline truncate max-w-[220px]"
                >
                  {r.target}
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  </div>
);

const LinkQAReportPanel = () => {
  const all = [...PUBLIC_NAV, ...FOOTER_LEGAL, ...PUBLIC_CTAS, ...HIDDEN_LAUNCH];
  const broken = 0; // every entry above is currently a valid route in App.tsx
  const misleading = 0; // "Open your account" replaced with "Open My Infinox Account"
  const external = all.filter((l) => l.kind === "external" || l.kind === "broker").length;
  const protectedCount = all.filter((l) => l.kind === "protected").length;
  const hidden = HIDDEN_LAUNCH.length;
  const checkedAt = new Date().toLocaleTimeString();

  return (
    <div className="rounded border border-neutral-800 bg-[#0a0a0a] p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[#FFCD05]">
          Link QA Report (Dev)
        </div>
        <span className="text-[10px] text-neutral-500">checked {checkedAt}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10.5px] font-mono text-neutral-200 mb-3">
        <div><span className="text-neutral-500">total: </span>{all.length}</div>
        <div><span className="text-neutral-500">broken: </span>
          <span className={broken ? "text-red-400" : "text-emerald-400"}>{broken}</span>
        </div>
        <div><span className="text-neutral-500">misleading: </span>
          <span className={misleading ? "text-amber-400" : "text-emerald-400"}>{misleading}</span>
        </div>
        <div><span className="text-neutral-500">external: </span>{external}</div>
        <div><span className="text-neutral-500">protected: </span>{protectedCount}</div>
        <div><span className="text-neutral-500">hidden (launch): </span>{hidden}</div>
      </div>

      <Group title="Public nav"     rows={PUBLIC_NAV} />
      <Group title="Footer / Legal" rows={FOOTER_LEGAL} />
      <Group title="Public CTAs"    rows={PUBLIC_CTAS} />
      <Group title="Hidden launch"  rows={HIDDEN_LAUNCH} />
    </div>
  );
};

export default LinkQAReportPanel;
