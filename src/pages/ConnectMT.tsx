import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Wallet,
  Activity,
  Plug,
  Radio,
  UserPlus,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMTAccount } from "@/hooks/useMTAccount";
import SEO from "@/components/SEO";
import EAWebhookSetup from "@/components/mt/EAWebhookSetup";
import { formatDistanceToNow } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";
import { track } from "@/lib/analytics";

const ConnectMT = () => {
  const { account, positions, refresh, loading } = useMTAccount();
  const { t } = useLanguage();

  const handleDisconnect = async () => {
    if (!account) return;
    if (!confirm("Disconnect this MetaTrader account? Your synced history will be removed.")) return;
    const { error } = await (supabase as any)
      .from("user_mt_accounts")
      .delete()
      .eq("id", account.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Account disconnected");
    refresh();
  };

  const handleRefresh = async () => {
    await refresh();
    toast.success("Checked for latest data");
  };

  const statusConfig = {
    pending: { color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-muted-foreground/30", label: "Pending", Icon: Loader2 },
    syncing: { color: "text-primary", bg: "bg-primary/10", ring: "ring-primary/40", label: "Syncing", Icon: Loader2 },
    connected: { color: "text-emerald-400", bg: "bg-emerald-500/10", ring: "ring-emerald-500/30", label: "Connected", Icon: CheckCircle2 },
    error: { color: "text-red-400", bg: "bg-red-500/10", ring: "ring-red-500/30", label: "Error", Icon: AlertCircle },
    disconnected: { color: "text-muted-foreground", bg: "bg-muted/40", ring: "ring-muted-foreground/30", label: "Disconnected", Icon: AlertCircle },
  } as const;

  return (
    <div className="min-h-screen bg-background pb-16">
      <SEO
        title="Connect MetaTrader Account | IX Live Trading Room"
        description="Securely link your MT4 or MT5 account using a free Custom EA Webhook to sync real balance, equity and trades in real-time."
        canonical="https://elitelivetradingroom.com/connect-mt"
      />

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link to="/dashboard" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Dashboard</span>
          </Link>
          <span className="font-heading text-sm font-semibold text-foreground">
            Connect <span className="text-primary">Trading Account</span>
          </span>
          <div className="w-20" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-6"
          style={{
            boxShadow: "0 20px 60px -25px hsl(48 100% 51% / 0.35)",
          }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/20 text-primary ring-1 ring-primary/40">
              <Plug className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold text-foreground">
                Connect via Custom EA Webhook
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Free, real-time sync that runs directly inside your MT4/MT5 terminal.
                No broker credentials leave your computer — your Expert Advisor pushes data
                straight to your dashboard every 8 seconds.
              </p>
            </div>
          </div>
        </motion.div>

        {!loading && account && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
          >
            <div className="border-b border-border/40 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
                  <Wallet className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="font-heading text-sm font-semibold text-foreground">
                    {account.nickname || `${account.platform.toUpperCase()} #${account.login}`}
                  </h2>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {account.broker_name} • {account.server_name}
                  </p>
                </div>
              </div>
              {(() => {
                const cfg = statusConfig[account.status];
                const Icon = cfg.Icon;
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider ring-1 ${cfg.bg} ${cfg.color} ${cfg.ring}`}
                  >
                    <Icon className={`h-3 w-3 ${account.status === "syncing" ? "animate-spin" : ""}`} />
                    {cfg.label}
                  </span>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-5">
              {[
                { label: "Balance", value: account.balance },
                { label: "Equity", value: account.equity },
                { label: "Margin", value: account.margin },
                { label: "Free Margin", value: account.free_margin },
              ].map((m) => (
                <div key={m.label}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {m.label}
                  </div>
                  <div className="font-mono text-base font-bold tabular-nums text-foreground mt-0.5">
                    {m.value != null
                      ? `$${Number(m.value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border/40 px-6 py-4 flex items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground font-mono">
                {account.last_synced_at
                  ? `Last synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
                  : "Never synced"}
                {positions.length > 0 && ` • ${positions.length} open position${positions.length === 1 ? "" : "s"}`}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDisconnect}
                className="rounded-lg gap-1.5 text-red-400 hover:text-red-300 border-red-500/30 hover:border-red-500/60"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            </div>
          </motion.div>
        )}

        {!loading && (
          <>
            <EAWebhookSetup />

            {/* Live data status */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden"
            >
              <div className="border-b border-border/40 px-5 py-3 flex items-center justify-between gap-3">
                <h3 className="font-heading text-sm font-semibold text-foreground inline-flex items-center gap-2">
                  <Radio className="h-4 w-4 text-primary" /> Live data status
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRefresh}
                  className="rounded-lg gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </Button>
              </div>

              <div className="px-5 py-6">
                {account ? (
                  <div className="flex items-start gap-3">
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/30">
                      <span className="absolute inline-flex h-2.5 w-2.5 animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        Receiving data from your EA
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Last update {account.last_synced_at
                          ? formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })
                          : "—"}
                        {" • "}
                        Balance ${Number(account.balance ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        {" • "}
                        {positions.length} open position{positions.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted/40 ring-1 ring-border/50">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="text-sm font-semibold text-foreground">
                        Waiting for data from your EA…
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Once you generate a token, install the Expert Advisor and attach it
                        to a chart in MT4/MT5, your live account data will appear here within ~10 seconds.
                        Hit <span className="text-foreground font-medium">Refresh</span> to check again.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}
      </main>
    </div>
  );
};

export default ConnectMT;
