import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, RefreshCw, FileJson, FileSpreadsheet } from "lucide-react";
import translations, { type Locale } from "@/i18n/translations";

// Eagerly load all source files as raw strings for static analysis
const RAW_FILES = import.meta.glob("/src/**/*.{tsx,ts}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const LOCALES: Locale[] = ["en", "es", "pt"];

const BRAND_TERMS = [
  "IX LTR",
  "LTR Terminal Pro",
  "INFINOX",
  "Trading Layer",
  "MT5",
  "MT4",
  "Market Watch",
  "Bid",
  "Ask",
  "Webinars",
  "Webinar",
  "Dashboard",
  "Email",
  "SSO",
  "API",
  "URL",
  "OK",
  "ID",
  "Pro",
  "Live",
  "Demo",
  "Stop Loss",
  "Take Profit",
  "Lot",
  "PIP",
  "EUR/USD",
  "USD",
  "EUR",
];

const COMPLIANCE_TERMS = [
  "signal",
  "signals",
  "señal",
  "señales",
  "sinal",
  "sinais",
  "copy trading",
  "copy trade",
  "copied trades",
  "guaranteed",
  "risk-free",
  "asesoría financiera",
  "recomendación de inversión",
  "aconselhamento financeiro",
  "recomendação de investimento",
];

const ALLOWED_CONTEXTS = [
  "not trading signals",
  "no son señales",
  "não são sinais",
  "are not signals",
];

const PUBLIC_PAGES = [
  "/src/pages/Index.tsx",
  "/src/pages/Community.tsx",
  "/src/pages/Webinars.tsx",
  "/src/pages/WebinarLanding.tsx",
  "/src/pages/Ideas.tsx",
  "/src/pages/Terms.tsx",
  "/src/pages/RiskDisclosure.tsx",
  "/src/pages/Login.tsx",
  "/src/pages/Register.tsx",
];

type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  id: string;
  type:
    | "missing-key"
    | "duplicate-key"
    | "hardcoded"
    | "compliance"
    | "mixed-language"
    | "seo";
  severity: Severity;
  locale?: Locale;
  page?: string;
  key?: string;
  value?: string;
  file?: string;
  detail: string;
}

const isProbablyEnglish = (s: string) => /\b(the|and|with|your|trading|account|live|free|new|home|about)\b/i.test(s);
const isProbablyEs = (s: string) => /\b(de|la|el|los|las|para|con|cuenta|gratis|inicio|nuevo|nueva)\b/i.test(s) || /[áéíóúñ¿¡]/i.test(s);

const sevRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const escapeCsv = (s: string) => `"${(s ?? "").toString().replace(/"/g, '""').replace(/\n/g, " ")}"`;

const AdminTranslationQATab = () => {
  const [filterLang, setFilterLang] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterPage, setFilterPage] = useState<string>("");
  const [scanTick, setScanTick] = useState(0);
  const [lastScan, setLastScan] = useState<Date>(new Date());

  const report = useMemo(() => {
    const issues: Issue[] = [];
    const enMap = translations.en as Record<string, string>;
    const esMap = translations.es as Record<string, string>;
    const ptMap = translations.pt as Record<string, string>;

    const enKeys = Object.keys(enMap);
    const esKeys = Object.keys(esMap);
    const ptKeys = Object.keys(ptMap);
    const allKeys = new Set([...enKeys, ...esKeys, ...ptKeys]);

    // Missing keys
    allKeys.forEach((k) => {
      LOCALES.forEach((loc) => {
        const map = (loc === "en" ? enMap : loc === "es" ? esMap : ptMap);
        if (!(k in map) || !map[k]?.trim()) {
          const fallback = enMap[k] ?? esMap[k] ?? ptMap[k] ?? "";
          const isLegal = /^(risk\.|terms\.|legal\.|compliance\.|footer\.disclaimer)/.test(k);
          issues.push({
            id: `missing-${loc}-${k}`,
            type: "missing-key",
            severity: isLegal ? "critical" : "high",
            locale: loc,
            key: k,
            value: fallback,
            detail: `Key "${k}" missing in ${loc.toUpperCase()}`,
          });
        }
      });
    });

    // Duplicate values within a locale (likely copy-paste / unfinished translation)
    LOCALES.forEach((loc) => {
      const map = (loc === "en" ? enMap : loc === "es" ? esMap : ptMap) as Record<string, string>;
      const seen = new Map<string, string[]>();
      Object.entries(map).forEach(([k, v]) => {
        if (!v || v.length < 8) return;
        const norm = v.trim().toLowerCase();
        if (!seen.has(norm)) seen.set(norm, []);
        seen.get(norm)!.push(k);
      });
      seen.forEach((keys, v) => {
        if (keys.length > 1) {
          issues.push({
            id: `dup-${loc}-${keys[0]}`,
            type: "duplicate-key",
            severity: "medium",
            locale: loc,
            key: keys.join(", "),
            value: v,
            detail: `${keys.length} keys share identical value in ${loc.toUpperCase()}`,
          });
        }
      });
    });

    // Untranslated: ES or PT value identical to EN value (and not a brand)
    enKeys.forEach((k) => {
      const en = enMap[k];
      if (!en || en.length < 4) return;
      ["es", "pt"].forEach((loc) => {
        const v = (loc === "es" ? esMap : ptMap)[k];
        if (v && v === en && !BRAND_TERMS.some((b) => v.includes(b))) {
          issues.push({
            id: `untrans-${loc}-${k}`,
            type: "missing-key",
            severity: "medium",
            locale: loc as Locale,
            key: k,
            value: v,
            detail: `Value in ${loc.toUpperCase()} identical to EN (likely untranslated)`,
          });
        }
      });
    });

    // Scan source files
    const stringRegex = />\s*([A-ZÁÉÍÓÚÑa-záéíóúñ][^<>{}\n]{6,80})\s*</g;
    const jsxStringRegex = /(?:label|title|placeholder|aria-label|alt)\s*=\s*"([^"]{4,80})"/g;
    let hardcodedCount = 0;
    let complianceCount = 0;

    Object.entries(RAW_FILES).forEach(([path, content]) => {
      if (!content) return;
      if (path.includes("/i18n/") || path.includes("/admin/AdminTranslationQATab")) return;
      if (path.includes("/integrations/supabase/")) return;

      const isPage = path.includes("/pages/") || path.includes("/components/");
      if (!isPage) return;

      // Hardcoded user-facing strings
      const usesT = /\bt\(["'`]/.test(content);
      let m: RegExpExecArray | null;
      const localHardcoded = new Set<string>();
      while ((m = stringRegex.exec(content)) !== null) {
        const s = m[1].trim();
        if (s.length < 6) continue;
        if (!/[a-záéíóúñ]/i.test(s)) continue;
        if (/^[0-9.,%$\s]+$/.test(s)) continue;
        if (BRAND_TERMS.some((b) => s === b || s.startsWith(b))) continue;
        if (s.includes("{") || s.includes("}")) continue;
        if (s.startsWith("http") || s.startsWith("/")) continue;
        localHardcoded.add(s);
      }
      while ((m = jsxStringRegex.exec(content)) !== null) {
        const s = m[1].trim();
        if (s.length < 6) continue;
        if (!/[a-záéíóúñ]/i.test(s)) continue;
        if (BRAND_TERMS.some((b) => s.includes(b))) continue;
        if (s.includes("{") || s.includes("/")) continue;
        localHardcoded.add(s);
      }
      // Cap per file to avoid noise
      const arr = [...localHardcoded].slice(0, 6);
      arr.forEach((s, i) => {
        hardcodedCount++;
        issues.push({
          id: `hc-${path}-${i}`,
          type: "hardcoded",
          severity: usesT ? "low" : "medium",
          file: path,
          page: path.split("/").pop(),
          value: s,
          detail: usesT
            ? `Hardcoded string in file that uses t() — likely missed key`
            : `Hardcoded string in non-i18n component`,
        });
      });

      // Compliance terms (scan content / translation map values only — not import statements)
      const lower = content.toLowerCase();
      COMPLIANCE_TERMS.forEach((term) => {
        const t = term.toLowerCase();
        const idx = lower.indexOf(t);
        if (idx === -1) return;
        // window
        const window = lower.slice(Math.max(0, idx - 60), Math.min(lower.length, idx + t.length + 60));
        if (ALLOWED_CONTEXTS.some((a) => window.includes(a))) return;
        // Skip pure code identifiers
        if (/TradingSignals|signalsChannel|copytrading\.tsx|tradingsignals\.tsx/i.test(path)) return;
        complianceCount++;
        issues.push({
          id: `cmp-${path}-${term}`,
          type: "compliance",
          severity: "critical",
          file: path,
          page: path.split("/").pop(),
          value: term,
          detail: `Compliance-sensitive term "${term}" found`,
        });
      });
    });

    // Mixed-language detection in translation maps
    Object.entries(esMap).forEach(([k, v]) => {
      if (!v || v.length < 12) return;
      if (BRAND_TERMS.some((b) => v.includes(b))) return;
      if (isProbablyEnglish(v) && !isProbablyEs(v)) {
        issues.push({
          id: `mix-es-${k}`,
          type: "mixed-language",
          severity: "high",
          locale: "es",
          key: k,
          value: v,
          detail: `ES value appears to contain English text`,
        });
      }
    });
    Object.entries(ptMap).forEach(([k, v]) => {
      if (!v || v.length < 12) return;
      if (BRAND_TERMS.some((b) => v.includes(b))) return;
      // crude: if contains many ES-only diacritics + words
      if (/\b(ustedes|asesoría|gratis)\b/i.test(v)) {
        issues.push({
          id: `mix-pt-${k}`,
          type: "mixed-language",
          severity: "high",
          locale: "pt",
          key: k,
          value: v,
          detail: `PT value appears to contain Spanish text`,
        });
      } else if (isProbablyEnglish(v) && !/[ãõçáéíóú]/i.test(v)) {
        issues.push({
          id: `mix-pt-en-${k}`,
          type: "mixed-language",
          severity: "high",
          locale: "pt",
          key: k,
          value: v,
          detail: `PT value appears to contain English text`,
        });
      }
    });

    // SEO QA — check seo.* keys per page per locale
    const seoKeys = ["title", "description", "ogTitle", "ogDescription", "canonical"];
    const pages = ["home", "community", "webinars", "ideas", "terms", "risk", "membership", "faq"];
    pages.forEach((p) => {
      LOCALES.forEach((loc) => {
        const map = (loc === "en" ? enMap : loc === "es" ? esMap : ptMap) as Record<string, string>;
        seoKeys.forEach((sk) => {
          const k = `seo.${p}.${sk}`;
          if (!(k in map) || !map[k]?.trim()) {
            const sev: Severity = sk === "title" ? "critical" : sk === "description" ? "high" : "medium";
            issues.push({
              id: `seo-${loc}-${p}-${sk}`,
              type: "seo",
              severity: sev,
              locale: loc,
              page: p,
              key: k,
              detail: `Missing SEO ${sk} for ${p} (${loc.toUpperCase()})`,
            });
          }
        });
      });
    });

    // Coverage
    const coverage = LOCALES.reduce((acc, loc) => {
      const map = (loc === "en" ? enMap : loc === "es" ? esMap : ptMap) as Record<string, string>;
      const present = Object.keys(map).filter((k) => map[k]?.trim()).length;
      acc[loc] = { present, total: allKeys.size, pct: Math.round((present / allKeys.size) * 100) };
      return acc;
    }, {} as Record<Locale, { present: number; total: number; pct: number }>);

    const seoIssues = issues.filter((i) => i.type === "seo").length;
    const missingTotal = issues.filter((i) => i.type === "missing-key").length;
    const dupTotal = issues.filter((i) => i.type === "duplicate-key").length;

    return {
      issues: issues.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]),
      coverage,
      totals: {
        keys: allKeys.size,
        en: enKeys.length,
        es: esKeys.length,
        pt: ptKeys.length,
        missing: missingTotal,
        duplicates: dupTotal,
        hardcoded: hardcodedCount,
        compliance: complianceCount,
        seo: seoIssues,
        avgCoverage: Math.round(
          (coverage.en.pct + coverage.es.pct + coverage.pt.pct) / 3
        ),
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanTick]);

  const filtered = report.issues.filter((i) => {
    if (filterLang !== "all" && i.locale !== filterLang) return false;
    if (filterType !== "all" && i.type !== filterType) return false;
    if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
    if (filterPage && !(i.page ?? i.file ?? "").toLowerCase().includes(filterPage.toLowerCase()))
      return false;
    return true;
  });

  const exportCsv = () => {
    const rows = [
      ["id", "type", "severity", "locale", "page", "key", "value", "file", "detail"].join(","),
      ...filtered.map((i) =>
        [i.id, i.type, i.severity, i.locale ?? "", i.page ?? "", i.key ?? "", i.value ?? "", i.file ?? "", i.detail]
          .map(escapeCsv)
          .join(",")
      ),
    ].join("\n");
    downloadBlob(rows, "translation-qa.csv", "text/csv");
  };

  const exportJson = () => {
    downloadBlob(
      JSON.stringify({ generatedAt: lastScan.toISOString(), totals: report.totals, coverage: report.coverage, issues: filtered }, null, 2),
      "translation-qa.json",
      "application/json"
    );
  };

  const rescan = () => {
    setLastScan(new Date());
    setScanTick((t) => t + 1);
  };

  const StatCard = ({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: string }) => (
    <Card className="p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-heading text-2xl font-bold ${tone ?? "text-foreground"}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Coverage"
          value={`${report.totals.avgCoverage}%`}
          hint={`EN ${report.coverage.en.pct}% · ES ${report.coverage.es.pct}% · PT ${report.coverage.pt.pct}%`}
          tone={report.totals.avgCoverage >= 95 ? "text-primary" : "text-amber-400"}
        />
        <StatCard label="Total keys" value={report.totals.keys} hint={`EN ${report.totals.en} · ES ${report.totals.es} · PT ${report.totals.pt}`} />
        <StatCard label="Missing" value={report.totals.missing} tone={report.totals.missing ? "text-amber-400" : "text-primary"} />
        <StatCard label="Hardcoded" value={report.totals.hardcoded} tone={report.totals.hardcoded ? "text-amber-400" : "text-primary"} />
        <StatCard label="Compliance" value={report.totals.compliance} tone={report.totals.compliance ? "text-destructive" : "text-primary"} />
        <StatCard label="SEO issues" value={report.totals.seo} tone={report.totals.seo ? "text-amber-400" : "text-primary"} />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-xs text-muted-foreground mr-auto">
            Last scan: <span className="text-foreground">{lastScan.toLocaleString()}</span>
          </div>
          <Button variant="outline" size="sm" onClick={rescan}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Re-scan
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <FileJson className="h-3.5 w-3.5 mr-1.5" /> JSON
          </Button>
        </div>
      </Card>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Select value={filterLang} onValueChange={setFilterLang}>
            <SelectTrigger><SelectValue placeholder="Language" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All languages</SelectItem>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="es">Español</SelectItem>
              <SelectItem value="pt">Português</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger><SelectValue placeholder="Issue type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="missing-key">Missing keys</SelectItem>
              <SelectItem value="duplicate-key">Duplicates</SelectItem>
              <SelectItem value="hardcoded">Hardcoded</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="mixed-language">Mixed language</SelectItem>
              <SelectItem value="seo">SEO</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterSeverity} onValueChange={setFilterSeverity}>
            <SelectTrigger><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder="Filter by page/file…" value={filterPage} onChange={(e) => setFilterPage(e.target.value)} />
        </div>
      </Card>

      {/* Results */}
      <Card className="p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/40 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Findings <span className="text-muted-foreground font-normal">({filtered.length})</span>
          </h3>
        </div>
        <div className="max-h-[560px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Severity</TableHead>
                <TableHead className="w-[120px]">Type</TableHead>
                <TableHead className="w-[60px]">Lang</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Key / Value</TableHead>
                <TableHead>Page / File</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 500).map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        i.severity === "critical"
                          ? "border-destructive/40 text-destructive"
                          : i.severity === "high"
                          ? "border-amber-500/40 text-amber-400"
                          : i.severity === "medium"
                          ? "border-blue-500/40 text-blue-400"
                          : "border-border text-muted-foreground"
                      }
                    >
                      {i.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{i.type}</TableCell>
                  <TableCell className="text-xs uppercase">{i.locale ?? "-"}</TableCell>
                  <TableCell className="text-xs">{i.detail}</TableCell>
                  <TableCell className="text-xs">
                    {i.key && <div className="font-mono text-[11px] text-foreground truncate max-w-[260px]">{i.key}</div>}
                    {i.value && <div className="text-muted-foreground truncate max-w-[260px]">{i.value}</div>}
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground truncate max-w-[220px]">
                    {i.page ?? i.file ?? "-"}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    No issues for the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {filtered.length > 500 && (
          <div className="px-4 py-2 text-[11px] text-muted-foreground border-t border-border/40">
            Showing first 500 of {filtered.length} findings. Use filters or export for full list.
          </div>
        )}
      </Card>
    </div>
  );
};

function downloadBlob(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default AdminTranslationQATab;
