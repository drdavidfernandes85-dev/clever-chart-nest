// Minimal typed server-side Trading Layer client.
// ALL calls happen server-side in Supabase Edge Functions.
// The API key is read from Deno.env once and never returned to the caller.

const BASE_URL = "https://api.trading-layer.com";

function key(): string {
  const k = Deno.env.get("TRADING_LAYER_API_KEY");
  if (!k) throw new Error("TRADING_LAYER_API_KEY missing");
  return k;
}

function headers() {
  return {
    Authorization: `Bearer ${key()}`,
    "Content-Type": "application/json",
  };
}

export interface AccountInfo {
  login: number | null;
  server: string | null;
  trade_allowed: boolean | null;
  trade_mode: number | null;
  name?: string | null;
  currency?: string | null;
  balance?: number | null;
  equity?: number | null;
  raw: any;
}

export async function getAccountInfo(accountId: string): Promise<{
  ok: boolean;
  status: number;
  data: AccountInfo | null;
  error?: string;
}> {
  const r = await fetch(`${BASE_URL}/api/v1/accounts/${accountId}`, {
    headers: headers(),
  });
  const txt = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
  if (!r.ok) return { ok: false, status: r.status, data: null, error: `account_fetch_${r.status}` };
  const d = parsed?.data ?? parsed;
  return {
    ok: true,
    status: r.status,
    data: {
      login: d?.login ?? null,
      server: d?.server ?? null,
      trade_allowed: typeof d?.trade_allowed === "boolean" ? d.trade_allowed : null,
      trade_mode: typeof d?.trade_mode === "number" ? d.trade_mode : null,
      name: d?.name ?? null,
      currency: d?.currency ?? null,
      balance: d?.balance ?? null,
      equity: d?.equity ?? null,
      raw: d,
    },
  };
}

export interface SymbolDetail {
  name: string;
  path?: string | null;
  description?: string | null;
  visible?: boolean | null;
  digits?: number | null;
  point?: number | null;
  trade_mode?: number | null;
  trade_exemode?: number | null;
  trade_contract_size?: number | null;
  trade_tick_value?: number | null;
  trade_tick_size?: number | null;
  volume_min?: number | null;
  volume_max?: number | null;
  volume_step?: number | null;
  filling_mode?: number | null;
  order_mode?: number | null;
  currency_base?: string | null;
  currency_profit?: string | null;
  currency_margin?: string | null;
  raw: any;
}

export async function getSymbolInfo(
  accountId: string,
  brokerSymbol: string,
): Promise<{ ok: boolean; status: number; data: SymbolDetail | null; error?: string }> {
  const r = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/symbols/${encodeURIComponent(brokerSymbol)}`,
    { headers: headers() },
  );
  const txt = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
  if (!r.ok) return { ok: false, status: r.status, data: null, error: `symbol_fetch_${r.status}` };
  const d = parsed?.data ?? parsed;
  return {
    ok: true,
    status: r.status,
    data: d ? { ...d, name: String(d.name ?? brokerSymbol), raw: d } as SymbolDetail : null,
  };
}

export interface ListSymbolsParams {
  group?: string;
  search?: string;
  visible?: boolean | null;
  limit?: number;
  offset?: number;
  sort?: "name" | "path" | "visible";
  order?: "asc" | "desc";
}

export async function listSymbols(
  accountId: string,
  params: ListSymbolsParams = {},
): Promise<{
  ok: boolean;
  status: number;
  data: any[];
  meta: { limit: number; offset: number; count: number; hasMore: boolean } | null;
  error?: string;
}> {
  const qs = new URLSearchParams();
  if (params.group) qs.set("group", params.group);
  if (params.search) qs.set("search", params.search);
  if (params.visible != null) qs.set("visible", String(params.visible));
  qs.set("limit", String(params.limit ?? 1000));
  qs.set("offset", String(params.offset ?? 0));
  qs.set("sort", params.sort ?? "name");
  qs.set("order", params.order ?? "asc");

  const r = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/symbols?${qs.toString()}`,
    { headers: headers() },
  );
  const txt = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
  if (!r.ok) {
    return { ok: false, status: r.status, data: [], meta: null, error: `symbols_fetch_${r.status}` };
  }
  return {
    ok: true,
    status: r.status,
    data: Array.isArray(parsed?.data) ? parsed.data : [],
    meta: parsed?.meta ?? null,
  };
}

/**
 * Paginated fetch of all symbols using OpenAPI offset pagination.
 * Stops when meta.hasMore is false or when a hard page cap is hit.
 */
export async function listAllSymbols(
  accountId: string,
  params: Omit<ListSymbolsParams, "limit" | "offset"> = {},
  maxPages = 20,
): Promise<{
  ok: boolean;
  rows: any[];
  pages: number;
  complete: boolean;
  errors: string[];
}> {
  const rows: any[] = [];
  const errors: string[] = [];
  const pageSize = 1000;
  let offset = 0;
  let page = 0;
  let hasMore = true;
  while (hasMore && page < maxPages) {
    const r = await listSymbols(accountId, { ...params, limit: pageSize, offset });
    page += 1;
    if (!r.ok) {
      errors.push(r.error ?? "symbols_fetch_failed");
      return { ok: false, rows, pages: page, complete: false, errors };
    }
    rows.push(...r.data);
    hasMore = !!r.meta?.hasMore;
    offset += r.data.length || pageSize;
    if (r.data.length === 0) break;
  }
  return { ok: true, rows, pages: page, complete: !hasMore, errors };
}

export async function getLatestTick(
  accountId: string,
  brokerSymbol: string,
): Promise<{ ok: boolean; status: number; data: any | null; error?: string }> {
  const r = await fetch(
    `${BASE_URL}/api/v1/accounts/${accountId}/symbols/${encodeURIComponent(brokerSymbol)}/tick`,
    { headers: headers() },
  );
  const txt = await r.text();
  let parsed: any = null;
  try { parsed = JSON.parse(txt); } catch { parsed = { raw: txt }; }
  if (!r.ok) return { ok: false, status: r.status, data: null, error: `tick_fetch_${r.status}` };
  return { ok: true, status: r.status, data: parsed?.data ?? parsed };
}
