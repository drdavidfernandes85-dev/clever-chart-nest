// Shared helper: resolve broker symbol with one-shot stale-cache self-heal.
//
// When `resolveEligibleBrokerSymbol` returns BROKER_SYMBOL_MAPPING_STALE
// (either empty-catalog or TTL expiry), this helper invokes
// `sync-broker-symbol-catalog` for the targeted symbol via service-role
// then re-resolves ONCE. Only if the second resolve is still stale do we
// surface the rejection.
//
// Used by every Trading-Layer mutation path (entry, exit, modify, cancel,
// pending submit) so members never see a stale-cache rejection as their
// first response to an action.

import {
  resolveEligibleBrokerSymbol,
  ERR_BROKER_SYMBOL_MAPPING_STALE,
} from "./brokerSymbol.ts";

type ResolveArgs = Parameters<typeof resolveEligibleBrokerSymbol>[1];
type ResolveResult = Awaited<ReturnType<typeof resolveEligibleBrokerSymbol>>;

async function targetedRefresh(targetUserId: string | null, canonical: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return;
    await fetch(`${supabaseUrl}/functions/v1/sync-broker-symbol-catalog`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": serviceKey,
        "x-internal-stale-refresh": "1",
      },
      body: JSON.stringify({
        symbols: canonical ? [canonical] : [],
        mode: "targeted_symbol_refresh",
        targetUserId: targetUserId ?? undefined,
      }),
    }).catch(() => null);
  } catch { /* best-effort */ }
}

export async function resolveBrokerSymbolWithSelfHeal(
  supabaseService: any,
  args: ResolveArgs,
  opts?: { targetUserId?: string | null; canonicalForRefresh?: string | null },
): Promise<ResolveResult & { selfHealAttempted: boolean }> {
  const first = await resolveEligibleBrokerSymbol(supabaseService, args);
  if (first.ok || first.errorCode !== ERR_BROKER_SYMBOL_MAPPING_STALE) {
    return { ...first, selfHealAttempted: false };
  }
  const canonical = (opts?.canonicalForRefresh
    ?? (args as any).requestedDisplaySymbol
    ?? (args as any).suppliedBrokerSymbol
    ?? "").toString().toUpperCase();
  await targetedRefresh(opts?.targetUserId ?? (args as any).userId ?? null, canonical);
  const second = await resolveEligibleBrokerSymbol(supabaseService, args);
  return { ...second, selfHealAttempted: true };
}
