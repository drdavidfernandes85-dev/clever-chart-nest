import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDevMode } from "@/hooks/useDevMode";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface AuditRow {
  id: string;
  created_at: string;
  symbol: string;
  side: string;
  volume: number;
  status: string;
  outcome: string;
  classification: string | null;
  requested_price: number | null;
  executed_price: number | null;
  bid: number | null;
  ask: number | null;
  spread: number | null;
  slippage: number | null;
  latency_ms: number | null;
  broker_message: string | null;
  retcode: number | null;
  reason: string | null;
  rule_violated: string | null;
  ticket: string | null;
  trade_id: string | null;
  raw: any | null;
}

const STATUS_LABELS: Record<string, string> = {
  dry_run: "Dry Run",
  placed: "Broker Accepted",
  broker_accepted_pending_confirmation: "Broker Accepted",
  position_confirmed: "Position Confirmed",
  confirmation_delayed_rate_limited: "Confirmation Delayed",
  execution_unconfirmed: "Waiting for MT5 Confirmation",
  unconfirmed_after_reconciliation: "Unconfirmed",
  pending_order_placed: "Pending Order Placed",
  order_found_not_filled: "Order Found Not Filled",
  deal_found_no_position: "Deal Found No Position",
  closed: "Position Closed",
  close_failed: "Close Failed",
  protection_modified: "SL/TP Modified",
  rate_limited: "Rate Limited",
  blocked: "Blocked",
};

const CLASSIFICATION_LABELS: Record<string, string> = {
  broker_accepted: "Broker Accepted",
  confirmation_pending: "Waiting for MT5 Confirmation",
  placed_confirmed: "Placed (Confirmed)",
  placed_unconfirmed: "Placed (Unconfirmed)",
  confirmation_delayed_rate_limited: "Delayed by Rate Limit",
  unconfirmed_after_reconciliation: "Unconfirmed After Checks",
  pending_order: "Pending Order",
  execution_reconciled: "Reconciled",
  rejected: "Rejected",
  blocked: "Blocked",
  closed: "Closed",
};

const STATUS_TONE: Record<string, string> = {
  position_confirmed: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-emerald-500/10 text-emerald-300",
  placed: "bg-[#FFCD05]/15 text-[#FFCD05]",
  broker_accepted_pending_confirmation: "bg-[#FFCD05]/15 text-[#FFCD05]",
  protection_modified: "bg-sky-500/15 text-sky-400",
  dry_run: "bg-neutral-500/15 text-neutral-300",
  confirmation_delayed_rate_limited: "bg-orange-500/15 text-orange-300",
  execution_unconfirmed: "bg-orange-500/15 text-orange-400",
  unconfirmed_after_reconciliation: "bg-orange-500/15 text-orange-400",
  pending_order_placed: "bg-yellow-500/15 text-yellow-300",
  order_found_not_filled: "bg-orange-500/15 text-orange-400",
  deal_found_no_position: "bg-orange-500/15 text-orange-400",
  rate_limited: "bg-purple-500/15 text-purple-400",
  close_failed: "bg-red-500/15 text-red-400",
  blocked: "bg-red-500/15 text-red-400",
};

const sideTone = (s: string) =>
  (s || "").toLowerCase() === "buy"
    ? "bg-emerald-500/15 text-emerald-400"
    : "bg-red-500/15 text-red-400";

const fmtNum = (v: number | null | undefined, d = 5) =>
  v == null || Number.isNaN(Number(v)) ? "—" : Number(v).toFixed(d);

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString([], {
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
};

const sourceSummary = (rec: any, source: "positions" | "orders" | "deals" | "pending") => {
  const checked = rec?.sourcesChecked?.[source];
  const skipped = rec?.sourcesSkipped?.[source] ?? null;
  const counts: Record<typeof source, string> = {
    positions: "positionsCount",
    orders: "ordersCount",
    deals: "dealsCount",
    pending: "pendingOrdersCount",
  };
  const count = rec?.checked?.[counts[source]];
  if (checked === true) return `Checked (${Number(count ?? 0)})`;
  if (skipped) return `Skipped: ${String(skipped).replace(/_/g, " ")}`;
  if (checked === false) return "No";
  return "No";
};

const csvEscape = (v: unknown) => {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const detectOpCategory = (r: AuditRow): "open" | "close" | "modify" | "pending" => {
  const s = (r.status || "").toLowerCase();
  const c = (r.classification || "").toLowerCase();
  if (s === "closed" || s === "close_failed" || c === "closed") return "close";
  if (s === "protection_modified") return "modify";
  if (s === "order_found_not_filled") return "pending";
  return "open";
};

const ExecutionHistoryPanel = () => {
  const { devMode } = useDevMode();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AuditRow | null>(null);
  const [retryingTradeId, setRetryingTradeId] = useState<string | null>(null);

  // filters
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState("all");
  const [classification, setClassification] = useState("all");
  const [side, setSide] = useState("all");
  const [opCategory, setOpCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("execution_audit_events")
        .select("*")
        .eq("user_id", auth.user.id)
        .order("created_at", { ascending: false })
        .limit(500);
      setRows((data ?? []) as unknown as AuditRow[]);
      setLoading(false);
    };
    load();
    const onTrade = () => load();
    window.addEventListener("trade-executed", onTrade);
    const id = setInterval(load, 20_000);
    return () => {
      window.removeEventListener("trade-executed", onTrade);
      clearInterval(id);
    };
  }, []);

  const filtered = useMemo(() => {
    const symU = symbol.trim().toUpperCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 3600 * 1000 : null;
    return rows.filter((r) => {
      if (symU && !(r.symbol || "").toUpperCase().includes(symU)) return false;
      if (status !== "all" && r.status !== status) return false;
      if (classification !== "all" && (r.classification || "") !== classification)
        return false;
      if (side !== "all" && (r.side || "").toLowerCase() !== side) return false;
      if (opCategory !== "all" && detectOpCategory(r) !== opCategory) return false;
      const t = new Date(r.created_at).getTime();
      if (from && t < from) return false;
      if (to && t > to) return false;
      return true;
    });
  }, [rows, symbol, status, classification, side, opCategory, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const confirmed = filtered.filter((r) => r.status === "position_confirmed").length;
    const failed = filtered.filter((r) =>
      ["blocked", "close_failed"].includes(r.status) ||
      (r.classification || "") === "rejected",
    ).length;
    const unconfirmed = filtered.filter((r) =>
      [
        "execution_unconfirmed",
        "order_found_not_filled",
        "deal_found_no_position",
      ].includes(r.status),
    ).length;
    const rateLimited = filtered.filter((r) => r.status === "rate_limited").length;
    const latencies = filtered
      .map((r) => r.latency_ms)
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    const spreads = filtered
      .map((r) => r.spread)
      .filter((n): n is number => typeof n === "number" && !Number.isNaN(n));
    const avgLatency = latencies.length
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;
    const avgSpread = spreads.length
      ? spreads.reduce((a, b) => a + b, 0) / spreads.length
      : null;
    return { total, confirmed, failed, unconfirmed, rateLimited, avgLatency, avgSpread };
  }, [filtered]);

  const exportCsv = () => {
    const headers = [
      "created_at",
      "symbol",
      "side",
      "volume",
      "status",
      "classification",
      "requested_price",
      "executed_price",
      "bid",
      "ask",
      "spread",
      "slippage",
      "latency_ms",
      "ticket",
      "broker_message",
    ];
    const lines = [headers.join(",")];
    for (const r of filtered) {
      lines.push(
        [
          r.created_at,
          r.symbol,
          r.side,
          r.volume,
          r.status,
          r.classification ?? "",
          r.requested_price ?? "",
          r.executed_price ?? "",
          r.bid ?? "",
          r.ask ?? "",
          r.spread ?? "",
          r.slippage ?? "",
          r.latency_ms ?? "",
          r.ticket ?? "",
          r.broker_message ?? "",
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `execution-history-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetFilters = () => {
    setSymbol("");
    setStatus("all");
    setClassification("all");
    setSide("all");
    setOpCategory("all");
    setDateFrom("");
    setDateTo("");
  };

  const retryConfirmation = async (row: AuditRow) => {
    if (!row.trade_id || retryingTradeId) return;
    setRetryingTradeId(row.trade_id);
    const raw = row.raw || {};
    const rec = raw.reconciliation || {};
    const diag = raw.diagnostics || {};
    try {
      await supabase.functions.invoke("reconcile-execution", {
        body: {
          tradeId: row.trade_id,
          symbol: row.symbol,
          side: row.side,
          volume: Number(row.volume),
          requestedPrice: row.requested_price,
          clientClickAt: rec?.request?.clientClickAt ?? row.created_at,
          brokerRetcode: row.retcode ?? raw.retcode ?? null,
          brokerMessage: row.broker_message ?? null,
          positionTicket: row.ticket ?? raw.positionTicket ?? diag.positionTicket ?? null,
          orderId: raw.orderId ?? diag.orderId ?? null,
          dealId: raw.dealId ?? diag.dealId ?? null,
          requestId: raw.requestId ?? diag.requestId ?? null,
          clientOrderId: raw.clientOrderId ?? diag.clientOrderId ?? row.trade_id,
          brokerSymbol: raw.brokerSymbol ?? diag.brokerSymbol ?? row.symbol,
          rawExecutionResponse: raw,
        },
      });
      const { data } = await supabase
        .from("execution_audit_events")
        .select("*")
        .eq("id", row.id)
        .maybeSingle();
      if (data) {
        const updated = data as unknown as AuditRow;
        setRows((prev) => prev.map((r) => (r.id === row.id ? updated : r)));
        setDetail(updated);
      }
    } finally {
      setRetryingTradeId(null);
    }
  };

  const summaryCards: Array<[string, string]> = [
    ["Total Orders", String(stats.total)],
    ["Confirmed", String(stats.confirmed)],
    ["Rejected / Failed", String(stats.failed)],
    ["Unconfirmed", String(stats.unconfirmed)],
    ["Avg Latency", stats.avgLatency != null ? `${stats.avgLatency} ms` : "—"],
    ["Avg Spread", stats.avgSpread != null ? stats.avgSpread.toFixed(5) : "—"],
    ["Rate-Limit Events", String(stats.rateLimited)],
  ];

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {summaryCards.map(([k, v]) => (
          <div
            key={k}
            className="rounded border border-neutral-800/80 bg-[#0a0a0a] px-3 py-2"
          >
            <div className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
              {k}
            </div>
            <div className="font-mono text-[13px] font-bold tabular-nums text-neutral-100 mt-0.5">
              {v}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-2 rounded border border-neutral-800/80 bg-[#0a0a0a] p-2">
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
            Symbol
          </label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-500" />
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="EURUSD"
              className="h-8 w-32 pl-7 text-[11px] font-mono bg-[#0f0f0f] border-neutral-800"
            />
          </div>
        </div>
        <FilterSelect
          label="Status"
          value={status}
          onChange={setStatus}
          options={[["all", "All"], ...Object.entries(STATUS_LABELS)]}
        />
        <FilterSelect
          label="Classification"
          value={classification}
          onChange={setClassification}
          options={[["all", "All"], ...Object.entries(CLASSIFICATION_LABELS)]}
        />
        <FilterSelect
          label="Side"
          value={side}
          onChange={setSide}
          options={[
            ["all", "All"],
            ["buy", "Buy"],
            ["sell", "Sell"],
          ]}
        />
        <FilterSelect
          label="Type"
          value={opCategory}
          onChange={setOpCategory}
          options={[
            ["all", "All"],
            ["open", "Open"],
            ["close", "Close"],
            ["modify", "Modify"],
            ["pending", "Pending"],
          ]}
        />
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
            From
          </label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 w-36 text-[11px] font-mono bg-[#0f0f0f] border-neutral-800"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
            To
          </label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 w-36 text-[11px] font-mono bg-[#0f0f0f] border-neutral-800"
          />
        </div>
        <div className="ml-auto flex items-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="h-8 text-[10px] font-mono uppercase tracking-widest text-neutral-400 hover:text-neutral-100"
          >
            Reset
          </Button>
          <Button
            size="sm"
            onClick={exportCsv}
            disabled={!filtered.length}
            className="h-8 gap-1 text-[10px] font-mono uppercase tracking-widest bg-[#FFCD05] text-black hover:bg-[#FFCD05]/90"
          >
            <Download className="h-3 w-3" /> CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded border border-neutral-800/80 bg-[#0a0a0a]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading execution history…
          </div>
        ) : !filtered.length ? (
          <div className="py-8 text-center text-[11px] font-mono uppercase tracking-widest text-neutral-500">
            No execution events match the filters.
          </div>
        ) : (
          <table className="w-full min-w-[1200px] text-[11px] font-mono">
            <thead className="bg-[#0f0f0f] sticky top-0">
              <tr className="text-left text-[9px] uppercase tracking-widest text-neutral-500">
                <th className="px-3 py-2 font-normal">Time</th>
                <th className="px-2 py-2 font-normal">Symbol</th>
                <th className="px-2 py-2 font-normal">Side</th>
                <th className="px-2 py-2 font-normal text-right">Vol</th>
                <th className="px-2 py-2 font-normal">Status</th>
                <th className="px-2 py-2 font-normal">Class.</th>
                <th className="px-2 py-2 font-normal text-right">Req. Price</th>
                <th className="px-2 py-2 font-normal text-right">Exec. Price</th>
                <th className="px-2 py-2 font-normal text-right">Bid</th>
                <th className="px-2 py-2 font-normal text-right">Ask</th>
                <th className="px-2 py-2 font-normal text-right">Spread</th>
                <th className="px-2 py-2 font-normal text-right">Slip</th>
                <th className="px-2 py-2 font-normal text-right">Lat.</th>
                <th className="px-2 py-2 font-normal">Ticket</th>
                <th className="px-3 py-2 font-normal">Message</th>
                <th className="px-2 py-2 font-normal" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/70">
              {filtered.map((r) => {
                const label = STATUS_LABELS[r.status] || r.status;
                const tone = STATUS_TONE[r.status] || "bg-neutral-500/15 text-neutral-300";
                const confirmedTicket =
                  r.ticket ||
                  r?.raw?.reconciliation?.confirmedTicket ||
                  null;
                return (
                  <tr
                    key={r.id}
                    className="tabular-nums hover:bg-neutral-900/60 transition-colors"
                  >
                    <td className="px-3 py-1.5 text-neutral-400 whitespace-nowrap">
                      {fmtDate(r.created_at)}
                    </td>
                    <td className="px-2 py-1.5 font-bold text-neutral-100">{r.symbol}</td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${sideTone(r.side)}`}
                      >
                        {r.side}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-200">
                      {Number(r.volume).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${tone}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 text-neutral-400">
                      {r.classification
                        ? CLASSIFICATION_LABELS[r.classification] || r.classification
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-300">
                      {fmtNum(r.requested_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-300">
                      {fmtNum(r.executed_price)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-400">
                      {fmtNum(r.bid)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-400">
                      {fmtNum(r.ask)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-400">
                      {fmtNum(r.spread)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-400">
                      {fmtNum(r.slippage)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-neutral-400">
                      {r.latency_ms != null ? `${r.latency_ms}ms` : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-neutral-300">
                      {confirmedTicket ? `#${confirmedTicket}` : "—"}
                    </td>
                    <td
                      className="px-3 py-1.5 max-w-[280px] truncate text-neutral-400"
                      title={r.broker_message || ""}
                    >
                      {r.broker_message || "—"}
                    </td>
                    <td className="px-2 py-1.5">
                      <button
                        onClick={() => setDetail(r)}
                        className="text-[10px] font-mono uppercase tracking-widest text-[#FFCD05] hover:underline"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Details drawer */}
      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent
          side="right"
          className="w-[560px] sm:max-w-[560px] bg-[#0a0a0a] border-neutral-800 text-neutral-200 overflow-y-auto"
        >
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="font-mono text-sm uppercase tracking-widest text-neutral-100">
                  {detail.symbol} · {detail.side.toUpperCase()} ·{" "}
                  {Number(detail.volume).toFixed(2)}
                </SheetTitle>
                <SheetDescription className="font-mono text-[11px] text-neutral-500">
                  {fmtDate(detail.created_at)} · ID {detail.id.slice(0, 8)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-4 space-y-3 text-[11px] font-mono">
                <DetailGrid
                  items={[
                    ["Status", STATUS_LABELS[detail.status] || detail.status],
                    [
                      "Classification",
                      detail.classification
                        ? CLASSIFICATION_LABELS[detail.classification] ||
                          detail.classification
                        : "—",
                    ],
                    ["Outcome", detail.outcome || "—"],
                    ["Ticket", detail.ticket ? `#${detail.ticket}` : "—"],
                    ["Trade ID", detail.trade_id || "—"],
                    [
                      "Retcode",
                      detail.retcode != null ? String(detail.retcode) : "—",
                    ],
                    ["Requested Price", fmtNum(detail.requested_price)],
                    ["Executed Price", fmtNum(detail.executed_price)],
                    ["Bid", fmtNum(detail.bid)],
                    ["Ask", fmtNum(detail.ask)],
                    ["Spread", fmtNum(detail.spread)],
                    ["Slippage", fmtNum(detail.slippage)],
                    [
                      "Latency",
                      detail.latency_ms != null ? `${detail.latency_ms} ms` : "—",
                    ],
                    ["Rule Violated", detail.rule_violated || "—"],
                    ["Reason", detail.reason || "—"],
                  ]}
                />

                {detail.broker_message && (
                  <Section title="Broker Message">
                    <p className="text-neutral-300 whitespace-pre-wrap">
                      {detail.broker_message}
                    </p>
                  </Section>
                )}

                {detail.trade_id && [
                  "placed",
                  "broker_accepted_pending_confirmation",
                  "confirmation_delayed_rate_limited",
                  "execution_unconfirmed",
                  "unconfirmed_after_reconciliation",
                  "order_found_not_filled",
                  "pending_order_placed",
                ].includes(detail.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => retryConfirmation(detail)}
                    disabled={retryingTradeId === detail.trade_id}
                    className="h-8 gap-1 border-[#FFCD05]/40 text-[#FFCD05] hover:bg-[#FFCD05]/10"
                  >
                    {retryingTradeId === detail.trade_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    Retry Confirmation
                  </Button>
                )}

                <ReconciliationView raw={detail.raw} />

                {devMode && detail.raw ? (
                  <>
                    <JsonSection title="Request Payload" data={detail.raw?.request_payload ?? detail.raw?.request} />
                    <JsonSection title="Response Payload" data={detail.raw?.response_payload ?? detail.raw?.response} />
                    <JsonSection title="Pretrade Checks" data={detail.raw?.pretrade_checks ?? detail.raw?.pretradeChecks} />
                    <JsonSection title="Raw Broker Response" data={detail.raw?.broker ?? detail.raw?.rawBrokerResponse ?? detail.raw?.raw_execution_response} />
                    <JsonSection title="Reconciliation" data={detail.raw?.reconciliation} />
                    <JsonSection title="Full Raw" data={detail.raw} />
                  </>
                ) : (
                  <p className="text-[10px] uppercase tracking-widest text-neutral-600">
                    Enable Dev Mode to view raw JSON payloads.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const FilterSelect = ({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<[string, string]>;
}) => (
  <div className="flex flex-col gap-1">
    <label className="text-[9px] font-mono uppercase tracking-widest text-neutral-500">
      {label}
    </label>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-40 text-[11px] font-mono bg-[#0f0f0f] border-neutral-800">
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-[#0f0f0f] border-neutral-800 text-neutral-200">
        {options.map(([v, l]) => (
          <SelectItem key={v} value={v} className="text-[11px] font-mono">
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const DetailGrid = ({ items }: { items: Array<[string, string]> }) => (
  <div className="grid grid-cols-2 gap-2">
    {items.map(([k, v]) => (
      <div
        key={k}
        className="rounded border border-neutral-800/80 bg-[#0f0f0f] px-2 py-1.5"
      >
        <div className="text-[9px] uppercase tracking-widest text-neutral-500">
          {k}
        </div>
        <div className="tabular-nums text-neutral-100 mt-0.5">{v}</div>
      </div>
    ))}
  </div>
);

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded border border-neutral-800/80 bg-[#0f0f0f] p-2">
    <div className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">
      {title}
    </div>
    {children}
  </div>
);

const ReconciliationView = ({ raw }: { raw: any }) => {
  const rec = raw?.reconciliation;
  if (!rec || typeof rec !== "object") return null;
  return (
    <Section title="Reconciliation">
      <DetailGrid
        items={[
          ["Status", rec.status || "—"],
          ["MT5 Confirmed", rec.mt5Confirmed ? "Yes" : "No"],
          ["Confirmed Ticket", rec.confirmedTicket || "—"],
          [
            "Confirmed Price",
            rec.confirmedEntryPrice != null ? String(rec.confirmedEntryPrice) : "—",
          ],
          ["Positions Checked", sourceSummary(rec, "positions")],
          ["Orders Checked", sourceSummary(rec, "orders")],
          ["Deals Checked", sourceSummary(rec, "deals")],
          ["Pending Checked", sourceSummary(rec, "pending")],
          ["Rate Limit Hit", rec.rateLimitHit ? "Yes" : "No"],
          ["Retry After", rec.retryAfter != null ? `${rec.retryAfter}s` : "No"],
          ["Next Reconcile", rec.nextReconcileAt || "No"],
          ["Rate-Limited Endpoint", rec.endpointRateLimited || "No"],
        ]}
      />
      {rec.explanation && (
        <p className="mt-2 text-neutral-300 whitespace-pre-wrap">{rec.explanation}</p>
      )}
    </Section>
  );
};

const JsonSection = ({ title, data }: { title: string; data: any }) => {
  if (data == null) return null;
  return (
    <Section title={title}>
      <pre className="text-[10px] leading-snug text-neutral-300 whitespace-pre-wrap break-all max-h-64 overflow-auto">
        {JSON.stringify(data, null, 2)}
      </pre>
    </Section>
  );
};

export default ExecutionHistoryPanel;
