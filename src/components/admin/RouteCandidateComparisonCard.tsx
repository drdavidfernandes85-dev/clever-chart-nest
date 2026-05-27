import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, GitCompare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CandidateReport {
  label: string;
  id: string;
  account: {
    ok: boolean;
    httpStatus: number;
    error: string | null;
    login: number | string | null;
    server: string | null;
    trade_allowed: boolean | null;
    trade_mode_raw: number | null;
    trade_mode_label: string | null;
    identity_match: boolean;
  };
  symbols: {
    totalReturned: number;
    eurusd_variants: string[];
    xauusd_variants: string[];
    plus_suffix_count: number;
    plus_suffix_sample: string[];
    contains_EURUSD_plus: boolean;
  };
  eurusdPlusDetail: any;
  eurusdPlusTick: any;
  executionCandidate: boolean;
}

interface CompareResp {
  success: boolean;
  policy_version: string;
  candidates: CandidateReport[];
  recommendation: string;
  recommendationDetail: string;
}

const mask = (s: string) => (s.length <= 12 ? s : `${s.slice(0, 4)}…${s.slice(-4)}`);

export default function RouteCandidateComparisonCard() {
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<CompareResp | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("compare-route-candidates", {
        body: {},
      });
      if (error) throw error;
      setResp(data as CompareResp);
    } catch (e: any) {
      toast.error(e?.message ?? "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Route Candidate Comparison (read-only)</h3>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
          Compare 3 Candidates
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground mb-3">
        Compares trader route (A), previously selected route (B), and the
        Trading Layer-provided symbols route (C: 10b…d4f3) for identity match,
        trade permission, and EURUSD/XAUUSD/+ symbol catalogue. No mutations.
      </p>

      <div className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-[11px] text-amber-200 mb-3">
        Current blocker: Trading Layer reported <code>EURUSD+</code> from
        account route <code>10b…d4f3</code>, while previous live tests used{" "}
        <code>EURUSD</code> from route <code>559…bcfe</code> and were rejected
        (retcode 10017). Execution remains blocked until the correct route and
        broker symbol are confirmed.
      </div>

      {resp && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-border/50 text-muted-foreground">
                <tr>
                  <th className="text-left py-2 px-2">Candidate</th>
                  <th className="text-left py-2 px-2">ID</th>
                  <th className="text-left py-2 px-2">HTTP</th>
                  <th className="text-left py-2 px-2">Identity</th>
                  <th className="text-left py-2 px-2">trade_allowed</th>
                  <th className="text-left py-2 px-2">trade_mode</th>
                  <th className="text-left py-2 px-2">EURUSD variants</th>
                  <th className="text-left py-2 px-2">XAUUSD variants</th>
                  <th className="text-left py-2 px-2">+ count</th>
                  <th className="text-left py-2 px-2">Exec candidate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {resp.candidates.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 px-2">{c.label}</td>
                    <td className="py-2 px-2 font-mono">{mask(c.id)}</td>
                    <td className="py-2 px-2 font-mono">{c.account.httpStatus}</td>
                    <td className="py-2 px-2">
                      {c.account.identity_match ? (
                        <Badge variant="outline" className="border-emerald-400/40 text-emerald-300">match</Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-400/40 text-rose-300">no</Badge>
                      )}
                    </td>
                    <td className="py-2 px-2 font-mono">{String(c.account.trade_allowed)}</td>
                    <td className="py-2 px-2 font-mono">{c.account.trade_mode_label ?? "—"}</td>
                    <td className="py-2 px-2 font-mono">{c.symbols.eurusd_variants.join(", ") || "—"}</td>
                    <td className="py-2 px-2 font-mono">{c.symbols.xauusd_variants.join(", ") || "—"}</td>
                    <td className="py-2 px-2 font-mono">{c.symbols.plus_suffix_count}</td>
                    <td className="py-2 px-2">
                      {c.executionCandidate ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40">yes</Badge>
                      ) : (
                        <Badge variant="outline" className="border-rose-400/40 text-rose-300">no</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded border border-border/50 p-2 text-[11px]">
            <div className="font-semibold mb-1">Recommendation: {resp.recommendation}</div>
            <div className="text-muted-foreground">{resp.recommendationDetail}</div>
            <div className="text-muted-foreground mt-1">Policy: {resp.policy_version}</div>
          </div>
        </>
      )}
    </Card>
  );
}
