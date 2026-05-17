import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const AdminAnalyticsTab = () => {
  const [rangeDays, setRangeDays] = useState(7);
  const [sectionFilter, setSectionFilter] = useState<string>("__all__");
  const [eventFilter, setEventFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    supabase
      .from("analytics_events")
      .select("id,event,section,path,params,created_at,user_id")
      .gte("created_at", isoDaysAgo(rangeDays))
      .order("created_at", { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) setRows(data as Row[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [rangeDays]);

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
    return rows.filter((r) => {
      if (sectionFilter !== "__all__" && r.section !== sectionFilter) return false;
      if (eventFilter !== "__all__" && r.event !== eventFilter) return false;
      if (search) {
        const q = search.toLowerCase();
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
        (r) =>
          r.event === "cta_click" &&
          (r.params as Record<string, unknown> | null)?.cta === "open_terminal",
      ),
      webinarCTA: count(
        (r) =>
          r.event === "cta_click" &&
          (r.params as Record<string, unknown> | null)?.cta === "view_webinars",
      ),
    };
  }, [filtered]);

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
              Mostrando {filtered.length.toLocaleString()} de {rows.length.toLocaleString()} eventos
            </p>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>
        <div className="max-h-[480px] overflow-auto">
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
              {filtered.slice(0, 200).map((r) => (
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
