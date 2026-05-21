import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useIsAdmin } from "@/hooks/useIsAdmin";

/**
 * MT5 Mapping Health Notice
 *
 * Detects accounts whose Trading Layer mapping was created before
 * connect-mt5-v2 became the single writer of trader IDs, and asks the
 * user to reconnect once. The notice never exposes internal mapping
 * terminology to normal users — admins get a sanitized diagnostic panel.
 *
 * Stale-mapping detection (any of):
 *   - credential_status missing/empty
 *   - trading_layer_trader_id missing
 *   - last_tl_error_code in (TL_TRADER_NOT_FOUND, TL_ACCOUNT_NOT_FOUND)
 *   - metaapi_account_id equals tenant ownerAccountId pattern (i.e.
 *     equals trading_layer_account_id but NOT trading_layer_trader_id)
 *
 * No secrets are read or rendered.
 */

interface MappingRow {
  id: string;
  login: string | null;
  server_name: string | null;
  status: string | null;
  metaapi_account_id: string | null;
  trading_layer_account_id: string | null;
  trading_layer_trader_id: string | null;
  trading_layer_external_trader_id: string | null;
  credential_status: string | null;
  last_verified_at: string | null;
  last_tl_error_code: string | null;
}

const STALE_ERRORS = new Set(["TL_TRADER_NOT_FOUND", "TL_ACCOUNT_NOT_FOUND"]);

const isStale = (row: MappingRow): boolean => {
  if (!row) return false;
  if (!row.trading_layer_trader_id) return true;
  if (!row.credential_status) return true;
  if (row.last_tl_error_code && STALE_ERRORS.has(row.last_tl_error_code)) return true;
  // ownerAccountId pattern: metaapi_account_id matches trading_layer_account_id
  // but is NOT equal to the real trader id.
  if (
    row.metaapi_account_id &&
    row.trading_layer_account_id &&
    row.metaapi_account_id === row.trading_layer_account_id &&
    row.trading_layer_trader_id &&
    row.metaapi_account_id !== row.trading_layer_trader_id
  ) {
    return true;
  }
  return false;
};

const MT5MappingHealthNotice = () => {
  const { user, ready, isRefreshing } = useAuth();
  const { isAdmin } = useIsAdmin();
  const [row, setRow] = useState<MappingRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showDiag, setShowDiag] = useState(false);

  useEffect(() => {
    if (!ready || isRefreshing || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_mt_accounts")
        .select(
          "id, login, server_name, status, metaapi_account_id, trading_layer_account_id, trading_layer_trader_id, trading_layer_external_trader_id, credential_status, last_verified_at, last_tl_error_code"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setRow((data as MappingRow) ?? null);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, isRefreshing, user?.id]);

  if (!loaded || !row) return null;
  if (!isStale(row)) return null;

  return (
    <div className="mx-2 mt-2 lg:mx-3 rounded-md border border-[#FFCD05]/40 bg-[#FFCD05]/[0.06] px-3 py-2.5 text-[12px] text-ltr-silver-100">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FFCD05]" />
        <div className="flex-1 min-w-0">
          <div className="font-heading text-[13px] font-semibold text-ltr-silver-100">
            Please reconnect your MT5 account to refresh the Trading Layer connection mapping.
          </div>
          <div className="mt-0.5 text-[11px] text-ltr-silver-400">
            This does not affect your MT5 account. It only refreshes the secure connection
            between IX LTR PRO and Trading Layer.
          </div>

          {isAdmin && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowDiag((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-[color:var(--ltr-gold-border)] bg-black/40 px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest text-ltr-silver-300 hover:text-[#FFCD05]"
              >
                {showDiag ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                Admin diagnostics
              </button>
              {showDiag && (
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 rounded border border-[color:var(--ltr-gold-border)]/60 bg-black/60 px-3 py-2 font-mono text-[10px] text-ltr-silver-300">
                  <DiagRow k="local_row_id" v={row.id} />
                  <DiagRow k="mt5_login" v={row.login} />
                  <DiagRow k="mt5_server" v={row.server_name} />
                  <DiagRow k="credential_status" v={row.credential_status ?? "—"} />
                  <DiagRow k="last_verified_at" v={row.last_verified_at ?? "—"} />
                  <DiagRow k="last_tl_error_code" v={row.last_tl_error_code ?? "—"} />
                  <DiagRow k="metaapi_account_id" v={row.metaapi_account_id ?? "—"} />
                  <DiagRow k="trading_layer_account_id" v={row.trading_layer_account_id ?? "—"} />
                  <DiagRow k="trading_layer_trader_id" v={row.trading_layer_trader_id ?? "—"} />
                  <DiagRow k="trading_layer_external_trader_id" v={row.trading_layer_external_trader_id ?? "—"} />
                </div>
              )}
            </div>
          )}
        </div>
        <Link
          to="/connect-mt"
          className="shrink-0 inline-flex items-center gap-1.5 rounded border border-[#FFCD05] bg-[#FFCD05] px-3 py-1.5 text-[11px] font-mono font-bold uppercase tracking-widest text-black transition-colors hover:brightness-110"
        >
          <RefreshCw className="h-3 w-3" />
          Reconnect MT5 Account
        </Link>
      </div>
    </div>
  );
};

const DiagRow = ({ k, v }: { k: string; v: string | null }) => (
  <div className="flex gap-2 truncate">
    <span className="text-ltr-silver-500">{k}</span>
    <span className="truncate text-ltr-silver-200">{v ?? "—"}</span>
  </div>
);

export default MT5MappingHealthNotice;
