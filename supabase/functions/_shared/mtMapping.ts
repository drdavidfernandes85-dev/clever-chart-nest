// Shared MT5 → Trading Layer mapping resolver.
//
// Selects the most-trustworthy `user_mt_accounts` row for a given user and
// classifies its Trading Layer mapping as `valid | stale | missing`.
//
// Rules (in priority order):
//   1. Rows with a populated `trading_layer_trader_id` are always preferred.
//   2. Within that group, `credential_status='validated'` wins.
//   3. Then most-recent `last_verified_at`, then most-recent `created_at`.
//   4. Only `platform='mt5'` is considered for live execution.
//
// Mapping classification:
//   - valid   → trading_layer_trader_id is set
//   - stale   → trading_layer_trader_id is null AND credential_status != 'validated'
//               (typically an old row that captured the tenant ownerAccountId
//                into metaapi_account_id without a real traderId)
//   - missing → no row found, or row has no usable id at all

export type MappingStatus = "valid" | "stale" | "missing";

export interface ResolvedMtMapping {
  row: any | null;
  localRowId: string | null;
  traderId: string | null;            // The id used for TL `/traders/{id}` and `/accounts/{id}`
  metaapiAccountId: string | null;
  tradingLayerTraderId: string | null;
  tradingLayerExternalTraderId: string | null;
  tradingLayerAccountId: string | null;
  login: string | null;
  server: string | null;
  credentialStatus: string | null;
  lastVerifiedAt: string | null;
  status: MappingStatus;
}

export async function resolveActiveMtMapping(
  supabase: any,
  userId: string,
): Promise<ResolvedMtMapping> {
  const empty: ResolvedMtMapping = {
    row: null,
    localRowId: null,
    traderId: null,
    metaapiAccountId: null,
    tradingLayerTraderId: null,
    tradingLayerExternalTraderId: null,
    tradingLayerAccountId: null,
    login: null,
    server: null,
    credentialStatus: null,
    lastVerifiedAt: null,
    status: "missing",
  };

  const { data, error } = await supabase
    .from("user_mt_accounts")
    .select(
      "id, platform, login, server_name, status, credential_status, last_verified_at, created_at, metaapi_account_id, trading_layer_trader_id, trading_layer_external_trader_id, trading_layer_account_id, mapping_status, account_id_relationship_verified, ignored_for_execution",
    )
    .eq("user_id", userId)
    .eq("platform", "mt5")
    .eq("status", "connected")
    .or("ignored_for_execution.is.null,ignored_for_execution.eq.false");

  if (error || !Array.isArray(data) || data.length === 0) return empty;

  const score = (r: any) => {
    let s = 0;
    if (r.trading_layer_trader_id) s += 1000;
    if (r.credential_status === "validated") s += 100;
    if (r.last_verified_at) s += 10;
    return s;
  };
  const sorted = [...data].sort((a, b) => {
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    const ta = a.last_verified_at ? Date.parse(a.last_verified_at) : 0;
    const tb = b.last_verified_at ? Date.parse(b.last_verified_at) : 0;
    if (tb !== ta) return tb - ta;
    const ca = a.created_at ? Date.parse(a.created_at) : 0;
    const cb = b.created_at ? Date.parse(b.created_at) : 0;
    return cb - ca;
  });

  const row = sorted[0];
  const traderId =
    (row.trading_layer_trader_id as string | null) ||
    (row.metaapi_account_id as string | null) ||
    null;

  let status: MappingStatus;
  if (row.trading_layer_trader_id) {
    status = "valid";
  } else if (!traderId) {
    status = "missing";
  } else {
    // Has a metaapi_account_id but no resolved traderId — treat as stale
    // (typically the tenant ownerAccountId captured before the connect flow
    // was fixed). Execution must not proceed.
    status = "stale";
  }

  return {
    row,
    localRowId: row.id ?? null,
    traderId,
    metaapiAccountId: row.metaapi_account_id ?? null,
    tradingLayerTraderId: row.trading_layer_trader_id ?? null,
    tradingLayerExternalTraderId: row.trading_layer_external_trader_id ?? null,
    tradingLayerAccountId: row.trading_layer_account_id ?? null,
    login: row.login ?? null,
    server: row.server_name ?? null,
    credentialStatus: row.credential_status ?? null,
    lastVerifiedAt: row.last_verified_at ?? null,
    status,
  };
}

export const STALE_MAPPING_USER_MESSAGE =
  "Please reconnect your MT5 account to refresh the Trading Layer connection mapping.";

export const STALE_MAPPING_ERROR_CODE = "TL_MAPPING_STALE";
