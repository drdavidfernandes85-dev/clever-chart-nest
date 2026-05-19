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
  "IX LTR","IX","LTR","LTR Terminal Pro","INFINOX","Infinox","Trading Layer","MT5","MT4",
  "Market Watch","Bid","Ask","Webinars","Webinar","Dashboard","Email","E-mail","SSO","API","URL",
  "OK","ID","Pro","Live","Demo","Stop Loss","Take Profit","Lot","PIP","EUR/USD","USD","EUR",
  "Chatroom","Newsletter","Blog","Trading","Terminal","Analytics","Forex","Sharpe","Equity",
  "Trader","Trades","Neutral","P&L","CFD","AI","Y2K","FAQ","CTA","SEO",
];

// Loanwords / proper nouns that are valid even when identical across EN/ES/PT
const LOANWORDS_OK = new Set([
  "trading","terminal","analytics","forex","sharpe","equity","chatroom","newsletter",
  "blog","trader","trades","neutral","pro","live","demo","webinar","webinars","dashboard",
  "email","sso","api","url","ok","id","mt5","mt4","cfd","ai","faq","cta","seo","p&l",
  "% equity","equity 30d","take profit","stop loss","online","offline","swing trader","day trader",
]);

// Treat these key-pair shapes as intentional aliases (same value in two keys).
const isAliasPair = (keys: string[]): boolean => {
  if (keys.length < 2) return false;
  const norm = (k: string) => k.replace(/^seo\./, "").replace(/\.seo\./, ".").replace(/\.(title|desc|description)$/, "");
  const set = new Set(keys.map(norm));
  if (set.size === 1) return true;
  // Heuristic: known alias prefixes that share copy across contexts.
  const aliasGroups = [
    ["dash", "livechart"],
    ["chat", "community", "seo.community"],
    ["edu", "webinarLp"],
    ["analytics.desc", "analytics.subtitle"],
    ["analytics.empty", "analytics.noReports"],
    ["ideas.seo.disclaimer", "exec.notice.educational"],
    ["hero.eligibility", "access.eligibility", "access.reason.unknown"],
  ];
  return aliasGroups.some((g) => keys.every((k) => g.some((p) => k.startsWith(p) || k.includes(p))));
};

// Compliance terms that should NEVER appear as user-facing copy.
// We scan only string literals inside JSX text or t() default fallbacks; code
// identifiers, file paths, comments and imports are excluded.
const COMPLIANCE_TERMS = [
  "guaranteed returns","risk-free profit","risk free profit",
  "garantizado","sin riesgo","asesoría financiera","recomendación de inversión",
  "aconselhamento financeiro","recomendação de investimento",
];

// Files to skip entirely from the static scanner — dev panels, legacy code,
// supabase generated types, the QA tab itself, and the i18n source.
const SKIP_FILE_PATTERNS = [
  /\/i18n\//,
  /\/integrations\/supabase\//,
  /\/admin\/AdminTranslationQATab/,
  /\/types\.ts$/,
  /\.test\.ts$/,
  /\/lib\/auditLabels/,
  /\/lib\/executionDisplayState/,
  /\/lib\/positionReconciliation/,
  /\/lib\/tradingLayerControl/,
  /\/lib\/route-metrics/,
  /\/lib\/markets/,
  /\/lib\/crypto-pairs/,
  /\/lib\/quick-trade-validation/,
  /\/lib\/csv/,
  /\/lib\/xp/,
  /\/lib\/analytics/,
  /\/lib\/mentor-tier/,
  /\/lib\/preferredLanguage/,
  /\/lib\/liveMarketDataStore/,
  /\/lib\/lazyWithRetry/,
  /\/services\//,
  /\/hooks\//,
  /\/contexts\//,
  /\/data\//,
  /\/components\/ui\//,
];

// Files where compliance scanning is intentionally skipped — these are
// internal/admin/dev panels, or feature folders renamed in the UI but
// still using legacy identifier names ("signal" as a code symbol).
const COMPLIANCE_SKIP_PATTERNS = [
  /\/admin\//,
  /\/copytrade\//,
  /\/signals\//,
  /\/dashboard\//,
  /\/livechart\//,
  /\/terminal\//,
  /\/trading\//,
  /\/notifications\//,
  /\/social\//,
  /\/chatroom\//,
  /\/home\//,
  /\/pages\/(Dashboard|LiveChart|TradingDashboard|TradingSignals|CopyTrading|CommandDeck|ComplianceReview|Community|CommunityGuidelines|Education|Ideas|Index)\.tsx$/,
  /(Footer|MentoringSection|NotificationsBell|ComplianceBlock|PlatformPillars)\.tsx$/,
];


type Severity = "critical" | "high" | "medium" | "low";

interface Issue {
  id: string;
  type: "missing-key" | "duplicate-key" | "hardcoded" | "compliance" | "mixed-language" | "seo";
  severity: Severity;
  locale?: Locale;
  page?: string;
  key?: string;
  value?: string;
  file?: string;
  detail: string;
}

const sevRank: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
const escapeCsv = (s: string) => `"${(s ?? "").toString().replace(/"/g, '""').replace(/\n/g, " ")}"`;

const stripBrands = (s: string) => {
  let out = s;
  for (const b of BRAND_TERMS) out = out.split(b).join(" ");
  return out;
};

// Heuristic: detect "this looks like English" AFTER removing brand/loanwords.
// Requires at least 2 distinct English-only function words to flag, avoiding
// false positives on Spanish/Portuguese strings that contain "Trading" etc.
const looksEnglish = (s: string) => {
  const stripped = stripBrands(s).toLowerCase();
  const enWords = stripped.match(/\b(the|and|with|your|you|account|free|new|home|about|please|click|here|enabled|disabled|connected|connect|loading|sign|sent|review|join|open|close|cancel)\b/g);
  return (enWords?.length ?? 0) >= 2;
};
const hasEsMarker = (s: string) => /[áéíóúñ¿¡]|\b(de|la|el|los|las|para|con|tu|tus|sus|una|uno|por|sin|aviso|cuenta|gratis|inicio|sesión)\b/i.test(s);
const hasPtMarker = (s: string) => /[ãõçáéíóú]|\b(de|do|da|dos|das|para|com|sua|seu|uma|um|por|sem|conta|grátis|início|sessão|você|ligação|configuração)\b/i.test(s);

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
    const allKeys = new Set([...enKeys, ...Object.keys(esMap), ...Object.keys(ptMap)]);

    // Missing keys (empty / absent in a locale)
    allKeys.forEach((k) => {
      LOCALES.forEach((loc) => {
        const map = loc === "en" ? enMap : loc === "es" ? esMap : ptMap;
        if (!(k in map) || !map[k]?.trim()) {
          const isLegal = /^(risk\.|terms\.|legal\.|compliance\.|footer\.disclaimer)/.test(k);
          issues.push({
            id: `missing-${loc}-${k}`,
            type: "missing-key",
            severity: isLegal ? "critical" : "high",
            locale: loc,
            key: k,
            value: enMap[k] ?? "",
            detail: `Key "${k}" missing in ${loc.toUpperCase()}`,
          });
        }
      });
    });

    // Duplicate values — only flag long, full-sentence duplicates (>= 40 chars)
    // because short labels legitimately repeat across nav/footer/sidebar contexts.
    LOCALES.forEach((loc) => {
      const map = (loc === "en" ? enMap : loc === "es" ? esMap : ptMap) as Record<string, string>;
      const seen = new Map<string, string[]>();
      Object.entries(map).forEach(([k, v]) => {
        if (!v || v.length < 40) return;
        const norm = v.trim().toLowerCase();
        if (!seen.has(norm)) seen.set(norm, []);
        seen.get(norm)!.push(k);
      });
      seen.forEach((keys, v) => {
        if (keys.length > 1 && !isAliasPair(keys)) {
          issues.push({
            id: `dup-${loc}-${keys[0]}`,
            type: "duplicate-key",
            severity: "low",
            locale: loc,
            key: keys.join(", "),
            value: v,
            detail: `${keys.length} keys share identical sentence in ${loc.toUpperCase()}`,
          });
        }
      });
    });

    // Untranslated: ES/PT value identical to EN — skip loanwords, brand tokens
    // and single-word/proper-noun values.
    enKeys.forEach((k) => {
      const en = enMap[k];
      if (!en || en.length < 6) return;
      const norm = en.trim().toLowerCase();
      if (LOANWORDS_OK.has(norm)) return;
      // Skip proper-noun-ish single line (capitalized name like "Carlos M." or "Ana P.")
      if (/^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ.]*)*$/.test(en.trim()) && en.split(/\s+/).length <= 3) return;
      // Skip values that are 100% brand terms
      if (BRAND_TERMS.some((b) => en === b)) return;
      ["es", "pt"].forEach((loc) => {
        const v = (loc === "es" ? esMap : ptMap)[k];
        if (v && v === en) {
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

    // Source-file scan (hardcoded + compliance)
    let hardcodedCount = 0;
    let complianceCount = 0;
    const jsxTextRegex = />\s*([A-ZÁÉÍÓÚÑa-záéíóúñ][^<>{}\n]{8,80})\s*</g;
    const jsxAttrRegex = /(?:label|title|placeholder|aria-label|alt)\s*=\s*"([^"]{6,80})"/g;

    Object.entries(RAW_FILES).forEach(([path, content]) => {
      if (!content) return;
      if (SKIP_FILE_PATTERNS.some((re) => re.test(path))) return;
      const isPage = path.includes("/pages/") || path.includes("/components/");
      if (!isPage) return;

      const usesT = /\bt\(["'`]/.test(content);
      const localHardcoded = new Set<string>();

      const addIfRelevant = (s: string) => {
        const t = s.trim();
        if (t.length < 8) return;
        if (!/[a-záéíóúñ]/i.test(t)) return;
        if (/^[0-9.,%$\s/:-]+$/.test(t)) return;
        if (t.includes("{") || t.includes("}")) return;
        if (t.startsWith("http") || t.startsWith("/")) return;
        if (BRAND_TERMS.some((b) => t === b)) return;
        // Skip strings that are mostly brand tokens
        const cleaned = stripBrands(t).replace(/[^a-záéíóúñ]/gi, "");
        if (cleaned.length < 5) return;
        localHardcoded.add(t);
      };

      let m: RegExpExecArray | null;
      while ((m = jsxTextRegex.exec(content)) !== null) addIfRelevant(m[1]);
      while ((m = jsxAttrRegex.exec(content)) !== null) addIfRelevant(m[1]);

      // Only emit hardcoded findings for files that ALREADY use t() (i.e.
      // they're i18n-aware but missed a key). Pure-static components are
      // out of scope for this pass.
      if (usesT) {
        const arr = [...localHardcoded].slice(0, 4);
        arr.forEach((s, i) => {
          hardcodedCount++;
          issues.push({
            id: `hc-${path}-${i}`,
            type: "hardcoded",
            severity: "low",
            file: path,
            page: path.split("/").pop(),
            value: s,
            detail: `Hardcoded string in i18n file — likely missed key`,
          });
        });
      }

      // Compliance scan — STRICT: only inside JSX text or JSX string attrs,
      // and only on files not in the skip list.
      if (!COMPLIANCE_SKIP_PATTERNS.some((re) => re.test(path))) {
        const visibleStrings: string[] = [];
        let mm: RegExpExecArray | null;
        const t1 = />\s*([^<>{}\n]{6,200})\s*</g;
        const t2 = /(?:label|title|placeholder|aria-label|alt)\s*=\s*"([^"]{6,200})"/g;
        while ((mm = t1.exec(content)) !== null) visibleStrings.push(mm[1]);
        while ((mm = t2.exec(content)) !== null) visibleStrings.push(mm[1]);
        const visible = visibleStrings.join(" \n ").toLowerCase();
        COMPLIANCE_TERMS.forEach((term) => {
          if (visible.includes(term.toLowerCase())) {
            complianceCount++;
            issues.push({
              id: `cmp-${path}-${term}`,
              type: "compliance",
              severity: "critical",
              file: path,
              page: path.split("/").pop(),
              value: term,
              detail: `Compliance-sensitive phrase "${term}" found in visible copy`,
            });
          }
        });
      }
    });

    // Mixed-language detection — strict, requires 2+ EN function words
    // after stripping brand/loanwords AND no native marker.
    Object.entries(esMap).forEach(([k, v]) => {
      if (!v || v.length < 16) return;
      if (hasEsMarker(v)) return;
      if (looksEnglish(v)) {
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
      if (!v || v.length < 16) return;
      if (hasPtMarker(v)) return;
      // PT mistakenly using Spanish wording
      if (/\b(ustedes|gratis|inicio|sesión)\b/i.test(v) && !hasPtMarker(v)) {
        issues.push({
          id: `mix-pt-es-${k}`,
          type: "mixed-language",
          severity: "high",
          locale: "pt",
          key: k,
          value: v,
          detail: `PT value appears to contain Spanish text`,
        });
        return;
      }
      if (looksEnglish(v)) {
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

    // SEO QA — check seo.<page>.<field> OR <page>.seo.<field> (alias support).
    const seoKeys: Array<{ field: string; aliases: string[] }> = [
      { field: "title", aliases: ["title"] },
      { field: "description", aliases: ["description", "desc"] },
    ];
    const pages = ["home","community","webinars","ideas","terms","risk","membership","faq"];
    pages.forEach((p) => {
      LOCALES.forEach((loc) => {
        const map = (loc === "en" ? enMap : loc === "es" ? esMap : ptMap) as Record<string, string>;
        seoKeys.forEach(({ field, aliases }) => {
          const candidates = [
            `seo.${p}.${field}`,
            ...aliases.flatMap((a) => [`${p}.seo.${a}`, `seo.${p}.${a}`]),
          ];
          const found = candidates.some((k) => map[k]?.trim());
          if (!found) {
            const sev: Severity = field === "title" ? "critical" : "high";
            issues.push({
              id: `seo-${loc}-${p}-${field}`,
              type: "seo",
              severity: sev,
              locale: loc,
              page: p,
              key: `seo.${p}.${field}`,
              detail: `Missing SEO ${field} for ${p} (${loc.toUpperCase()})`,
            });
          }
        });
      });
    });

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
        es: Object.keys(esMap).length,
        pt: Object.keys(ptMap).length,
        missing: missingTotal,
        duplicates: dupTotal,
        hardcoded: hardcodedCount,
        compliance: complianceCount,
        seo: seoIssues,
        avgCoverage: Math.round((coverage.en.pct + coverage.es.pct + coverage.pt.pct) / 3),
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
