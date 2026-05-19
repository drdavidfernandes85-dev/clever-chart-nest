import { useEffect, useState } from "react";
import { Activity, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { useLiveAccount } from "@/contexts/LiveAccountContext";
import { useExecutionLock } from "@/hooks/useExecutionLock";
import { useLanguage } from "@/i18n/LanguageContext";


type Health = "ok" | "warn" | "down" | "unknown";

const dotClass = (h: Health) => {
  switch (h) {
    case "ok": return "bg-emerald-400";
    case "warn": return "bg-amber-400";
    case "down": return "bg-red-400";
    default: return "bg-neutral-500";
  }
};

const sinceLabel = (iso: string | null | undefined): string => {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
};

const Row = ({
  label, status, value,
}: { label: string; status: Health; value: string }) => (
  <div className="flex items-center justify-between gap-2 py-1 text-[11px]">
    <div className="flex items-center gap-1.5 text-neutral-400">
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass(status)}`} />
      <span className="uppercase tracking-wider text-[9px]">{label}</span>
    </div>
    <span className="font-mono tabular-nums text-neutral-200 truncate">{value}</span>
  </div>
);

const SystemHealthWidget = () => {
  const { t } = useLanguage();
  const { liveAccount, positions, connected, loading, refreshing, lastSyncAt } =
    useLiveAccount() as any;

  const { rateLimited, cooldownSec, locked, reason } = useExecutionLock();
  const [lastExec, setLastExec] = useState<{ status: string; at: string } | null>(null);
  const [, force] = useState(0);

  useEffect(() => {
    const tick = () => force((n) => n + 1);
    const id = window.setInterval(tick, 1000);
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ status: string }>;
      if (ev?.detail?.status) {
        setLastExec({ status: ev.detail.status, at: new Date().toISOString() });
      }
    };
    window.addEventListener("mt:exec-result", handler as EventListener);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("mt:exec-result", handler as EventListener);
    };
  }, []);

  const mt: Health = loading ? "unknown" : connected ? "ok" : "down";
  const tradingLayer: Health = rateLimited ? "warn" : connected ? "ok" : "unknown";
  const rateHealth: Health = rateLimited ? "warn" : "ok";

  return (
    <section className="rounded-md border border-neutral-800 bg-[#0a0a0a] p-2.5 text-neutral-100">
      <div className="flex items-center justify-between border-b border-neutral-800/80 pb-1.5 mb-1">
        <div className="flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-[#FFCD05]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">
            {t("terminal.systemHealth" as never)}
          </span>

        </div>
        {refreshing ? (
          <Loader2 className="h-3 w-3 animate-spin text-neutral-500" />
        ) : connected ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
        ) : (
          <AlertCircle className="h-3 w-3 text-red-400" />
        )}
      </div>
      <Row
        label="MT5"
        status={mt}
        value={connected ? "Connected" : loading ? "Checking…" : "Disconnected"}
      />
      <Row
        label="Trading Layer"
        status={tradingLayer}
        value={rateLimited ? `Cooling ${cooldownSec}s` : connected ? "Reachable" : "Idle"}
      />
      <Row
        label="Last Account Sync"
        status={lastSyncAt ? "ok" : "unknown"}
        value={sinceLabel(lastSyncAt)}
      />
      <Row
        label="Last Quote"
        status={positions?.length ? "ok" : "unknown"}
        value={positions?.length ? `${positions.length} open` : "—"}
      />
      <Row
        label="Last Execution"
        status={lastExec ? "ok" : "unknown"}
        value={lastExec ? `${lastExec.status} · ${sinceLabel(lastExec.at)}` : "—"}
      />
      <Row
        label="Rate Limit"
        status={rateHealth}
        value={rateLimited ? `${cooldownSec}s` : "OK"}
      />
      {locked && !rateLimited && (
        <div className="mt-1 text-[10px] text-amber-300">
          Execution locked: {reason ?? "in-flight request"}
        </div>
      )}
    </section>
  );
};

export default SystemHealthWidget;
