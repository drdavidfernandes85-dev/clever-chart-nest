import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Activity,
  MousePointerClick,
  Mail,
  Send,
  Loader2,
  TrendingUp,
  Download,
  Filter,
} from "lucide-react";

type Row = {
  id: string;
  event: string;
  section: string | null;
  path: string | null;
  params: Record<string, unknown> | null;
  created_at: string;
  user_id: string | null;
};

const PRESETS: { label: string; days: number }[] = [
  { label: "Hoy", days: 1 },
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Últimos 90 días", days: 90 },
];

const PAGE_SIZE = 200;

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const paramsCta = (p: Record<string, unknown> | null) =>
  (p?.cta as string | undefined) ?? null;

const AdminAnalyticsTab = () => {
  const [rangeDays, setRangeDays] = useState(7);
  const [sectionFilter, setSectionFilter] = useState<string>("__all__");
  const [eventFilter, setEventFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  const since = useMemo(() => isoDaysAgo(rangeDays), [rangeDays]);

  /** Fetch a single page using a created_at cursor (descending). */
  const fetchPage = useCallback(
    async (opts: { reset?: boolean; cursor?: string | null }) => {
      const isReset = !!opts.reset;
      if (isReset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      let q = supabase
        .from("analytics_events")
        .select("id,event,section,path,params,created_at,user_id")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);

      if (!isReset && opts.cursor) q = q.lt("created_at", opts.cursor);

      const { data, error } = await q;
      if (!error && data) {
        const page = data as Row[];
        setRows((prev) => (isReset ? page : [...prev, ...page]));
        setHasMore(page.length === PAGE_SIZE);
        setCursor(page.length ? page[page.length - 1].created_at : null);
      } else if (isReset) {
        setRows([]);
        setHasMore(false);
        setCursor(null);
      }

      setLoading(false);
      setLoadingMore(false);
    },
    [since],
  );

  useEffect(() => {
    fetchPage({ reset: true });
  }, [fetchPage]);

  const sections = useMemo(
    () =>
      Array.from(
        new Set(rows.map((r) => r.section).filter((s): s is string => !!s)),
      ).sort(),
    [rows],
  );
  const events = useMemo(
    () => Array.from(new Set(rows.map((r) => r.event))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sectionFilter !== "__all__" && r.section !== sectionFilter) return false;
      if (eventFilter !== "__all__" && r.event !== eventFilter) return false;
      if (q) {
        const blob =
          `${r.event} ${r.section ?? ""} ${r.path ?? ""} ${JSON.stringify(r.params ?? {})}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [rows, sectionFilter, eventFilter, search]);

  const metrics = useMemo(() => {
    const count = (predicate: (r: Row) => boolean) =>
      filtered.filter(predicate).length;
    return {
      pageViews: count((r) => r.event === "page_view"),
      ctaClicks: count((r) => r.event === "cta_click"),
      internalLinks: count((r) => r.event === "internal_link_click"),
      contactSubmits: count((r) => r.event === "contact_submit"),
      contactSuccess: count((r) => r.event === "contact_submit_success"),
      newsletterSubmits: count((r) => r.event === "newsletter_submit"),
      newsletterSuccess: count((r) => r.event === "newsletter_submit_success"),
      terminalCTA: count(
        (r) => r.event === "cta_click" && paramsCta(r.params) === "open_terminal",
      ),
      webinarCTA: count(
        (r) => r.event === "cta_click" && paramsCta(r.params) === "view_webinars",
      ),
    };
  }, [filtered]);

  /** Funnel: PageView → CTA → Conversion. Segmented automatically by the
   * active section / event / search filters above. */
  const funnel = useMemo(() => {
    const steps = [
      {
        key: "page_view",
        label: "Page View",
        value: metrics.pageViews,
      },
      {
        key: "cta_terminal",
        label: "CTA · Terminal",
        value: metrics.terminalCTA,
      },
      {
        key: "cta_webinar",
        label: "CTA · Webinars",
        value: metrics.webinarCTA,
      },
      {
        key: "contact_success",
        label: "Contacto OK",
        value: metrics.contactSuccess,
      },
      {
        key: "newsletter_success",
        label: "Newsletter OK",
        value: metrics.newsletterSuccess,
      },
    ];
    const base = steps[0].value || 1;
    let prev = steps[0].value;
    return steps.map((s, i) => {
      const pctFromTop = (s.value / base) * 100;
      const pctFromPrev = i === 0 ? 100 : prev > 0 ? (s.value / prev) * 100 : 0;
      prev = s.value;
      return { ...s, pctFromTop, pctFromPrev };
    });
  }, [metrics]);

  const eventsBySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of filtered) {
      const key = r.section ?? "—";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [filtered]);

  const conversionRate =
    metrics.pageViews > 0
      ? ((metrics.contactSuccess + metrics.newsletterSuccess) / metrics.pageViews) * 100
      : 0;

  /** Build a filename suffix that reflects the active filter set. */
  const exportSuffix = () => {
    const parts = [
      `${rangeDays}d`,
      sectionFilter !== "__all__" ? `sec-${sectionFilter}` : "",
      eventFilter !== "__all__" ? `evt-${eventFilter}` : "",
      search ? `q-${search.replace(/\s+/g, "_")}` : "",
    ].filter(Boolean);
    return parts.join("_");
  };

  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const escapeCsv = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "string" ? v : JSON.stringify(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCsv = () => {
    const header = ["created_at", "event", "section", "path", "user_id", "params"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      lines.push(
        [r.created_at, r.event, r.section, r.path, r.user_id, r.params]
          .map(escapeCsv)
          .join(","),
      );
    }
    // Metric summary as trailing block for context
    lines.push("");
    lines.push("# metrics");
    Object.entries(metrics).forEach(([k, v]) => lines.push(`${k},${v}`));
    lines.push(`conversion_rate_pct,${conversionRate.toFixed(2)}`);
    download(
      new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" }),
      `analytics_${exportSuffix()}.csv`,
    );
  };

  const exportJson = () => {
    const payload = {
      generated_at: new Date().toISOString(),
      filters: {
        range_days: rangeDays,
        since,
        section: sectionFilter === "__all__" ? null : sectionFilter,
        event: eventFilter === "__all__" ? null : eventFilter,
        search: search || null,
      },
      metrics: { ...metrics, conversion_rate_pct: Number(conversionRate.toFixed(2)) },
      funnel,
      events_by_section: eventsBySection.map(([section, count]) => ({ section, count })),
      events: filtered,
    };
    download(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `analytics_${exportSuffix()}.json`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-border/50 bg-card/50 p-4">
        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Rango</Label>
            <Select
              value={String(rangeDays)}
              onValueChange={(v) => setRangeDays(Number(v))}
            >
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRESETS.map((p) => (
                  <SelectItem key={p.days} value={String(p.days)}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Sección</Label>
            <Select value={sectionFilter} onValueChange={setSectionFilter}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las secciones</SelectItem>
                {sections.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Evento</Label>
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los eventos</SelectItem>
                {events.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase text-muted-foreground">Buscar</Label>
            <Input
              className="mt-1.5"
              placeholder="ruta, etiqueta, parámetro…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="h-3.5 w-3.5" />
            {filtered.length.toLocaleString()} eventos coinciden ·{" "}
            {rows.length.toLocaleString()} cargados
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} className="gap-2">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={exportJson} className="gap-2">
              <Download className="h-3.5 w-3.5" /> JSON
            </Button>
          </div>
        </div>
      </Card>

      {/* Metric cards */}
      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        <MetricCard icon={Activity} label="Page Views" value={metrics.pageViews} />
        <MetricCard icon={MousePointerClick} label="Clics CTA" value={metrics.ctaClicks} />
        <MetricCard icon={Send} label="Contacto enviado" value={metrics.contactSuccess} sub={`${metrics.contactSubmits} intentos`} />
        <MetricCard icon={Mail} label="Newsletter OK" value={metrics.newsletterSuccess} sub={`${metrics.newsletterSubmits} intentos`} />
        <MetricCard icon={MousePointerClick} label="CTA Terminal" value={metrics.terminalCTA} />
        <MetricCard icon={MousePointerClick} label="CTA Webinars" value={metrics.webinarCTA} />
      </div>

      {/* Funnel */}
      <Card className="border-border/50 bg-card/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider">
              Funnel de conversión
            </h3>
            <p className="text-xs text-muted-foreground">
              Page view → CTA (terminal / webinars) → conversión · refleja filtros activos
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase text-muted-foreground">Conversión global</div>
            <div className="font-mono text-2xl font-bold text-primary">
              {conversionRate.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          {funnel.map((step, i) => (
            <div key={step.key}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  {i + 1}. {step.label}
                </span>
                <span className="flex items-center gap-3 font-mono">
                  <span className="text-foreground">{step.value.toLocaleString()}</span>
                  <span className="text-muted-foreground">
                    {step.pctFromTop.toFixed(1)}% del total
                  </span>
                  {i > 0 && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] ${
                        step.pctFromPrev >= 25
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {step.pctFromPrev.toFixed(1)}% paso
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-md bg-muted">
                <div
                  className="h-full rounded-md bg-gradient-to-r from-primary to-primary/60 transition-[width] duration-500"
                  style={{ width: `${Math.max(2, step.pctFromTop)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Conversion + breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border-border/50 bg-card/50 p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Tasa de conversión
          </div>
          <div className="mt-2 text-3xl font-bold text-primary">
            {conversionRate.toFixed(2)}%
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            (Contactos + Newsletter exitosos) / Page Views en el período
          </p>
        </Card>

        <Card className="border-border/50 bg-card/50 p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Eventos por sección
          </div>
          <div className="mt-3 space-y-2">
            {eventsBySection.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin datos en el rango.</p>
            )}
            {eventsBySection.map(([sec, n]) => {
              const max = eventsBySection[0][1];
              return (
                <div key={sec}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-foreground">{sec}</span>
                    <span className="font-mono text-muted-foreground">{n}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary"
                      style={{ width: `${(n / max) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent events table */}
      <Card className="border-border/50 bg-card/50">
        <div className="flex items-center justify-between border-b border-border/50 p-4">
          <div>
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider">
              Eventos recientes
            </h3>
            <p className="text-xs text-muted-foreground">
              {filtered.length.toLocaleString()} eventos visibles · {rows.length.toLocaleString()} cargados
            </p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cuando</TableHead>
                <TableHead>Evento</TableHead>
                <TableHead>Sección</TableHead>
                <TableHead>Ruta</TableHead>
                <TableHead>Parámetros</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="border-primary/30 text-primary">
                      {r.event}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.section ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.path ?? "—"}</TableCell>
                  <TableCell className="max-w-[320px] truncate font-mono text-[11px] text-muted-foreground">
                    {r.params ? JSON.stringify(r.params) : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    Sin eventos para los filtros seleccionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-center justify-center gap-3 border-t border-border/50 p-3">
          {hasMore ? (
            <Button
              size="sm"
              variant="outline"
              disabled={loadingMore || loading}
              onClick={() => fetchPage({ cursor })}
              className="gap-2"
            >
              {loadingMore ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5" />
              )}
              Cargar {PAGE_SIZE} más
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              No hay más eventos en el rango seleccionado.
            </span>
          )}
        </div>
      </Card>
    </div>
  );
};

const MetricCard = ({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
}) => (
  <Card className="border-border/50 bg-card/50 p-4">
    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
      <Icon className="h-3.5 w-3.5 text-primary" /> {label}
    </div>
    <div className="mt-2 font-mono text-2xl font-bold text-foreground">
      {value.toLocaleString()}
    </div>
    {sub && <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div>}
  </Card>
);

export default AdminAnalyticsTab;
