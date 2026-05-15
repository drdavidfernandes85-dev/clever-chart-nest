import { useCallback, useEffect, useState } from "react";
import { Bug, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

/**
 * TEMPORARY debug panel — invokes get-live-account with { refresh: true, debug: true }
 * and renders the raw JSON response. Visible only in dev builds.
 */
export default function LiveAccountDebugPanel() {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const fetchDebug = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await supabase.functions.invoke("get-live-account", {
        body: { refresh: true, debug: true },
      });
      if (res.error) {
        setError(res.error.message ?? String(res.error));
        setData(res);
      } else {
        setData(res.data);
      }
      setFetchedAt(new Date().toISOString());
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDebug();
  }, [fetchDebug]);

  if (!import.meta.env.DEV) return null;

  return (
    <section className="rounded-xl border border-[#FFCD05]/30 bg-background/60 backdrop-blur p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-[#FFCD05]" />
          <h2 className="text-sm font-semibold tracking-wide">Live Account Debug</h2>
          <Badge variant="outline" className="border-[#FFCD05]/40 text-[#FFCD05] text-[10px]">
            DEV
          </Badge>
          {fetchedAt && (
            <span className="text-[10px] text-muted-foreground">
              {new Date(fetchedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchDebug}
          disabled={loading}
          className="border-[#FFCD05]/40 text-[#FFCD05] hover:bg-[#FFCD05]/10"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          )}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <pre className="max-h-[420px] overflow-auto rounded-lg bg-black/60 border border-border/40 p-3 text-[11px] leading-relaxed text-[#FFCD05]/90 font-mono whitespace-pre-wrap break-all">
        {data ? JSON.stringify(data, null, 2) : loading ? "Loading…" : "No data"}
      </pre>
    </section>
  );
}
