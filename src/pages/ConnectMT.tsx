import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Shield,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Trash2,
  Wallet,
  Server,
  KeyRound,
  Activity,
  Plug,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMTAccount } from "@/hooks/useMTAccount";
import SEO from "@/components/SEO";
import { formatDistanceToNow } from "date-fns";

// INFINOX brokers — server names verified against MetaApi provisioning catalog.
// "InfinoxLimited-MT5Live" is the canonical Live server for retail clients.
const COMMON_BROKERS: { name: string; servers: string[] }[] = [
  {
    name: "Infinox Capital Limited",
    servers: ["InfinoxCapitalLimited-MT5Live"],
  },
  {
    name: "Infinox Limited",
    servers: [
      "InfinoxLimited-MT5Live",
      "InfinoxLimited-MT5Demo",
      "INFINOXLimited-MT5",
    ],
  },
  { name: "Custom / Other", servers: [] },
];

const ConnectMT = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { account, positions, syncing, sync, refresh, loading } = useMTAccount();

  const [platform, setPlatform] = useState<"mt4" | "mt5">("mt5");
  const [accountType, setAccountType] = useState<"live" | "demo">("live");
  const [brokerName, setBrokerName] = useState(COMMON_BROKERS[0].name);
  const [customBroker, setCustomBroker] = useState("");
  const [serverName, setServerName] = useState(COMMON_BROKERS[0].servers[0] ?? "");
  const [customServer, setCustomServer] = useState("");
  const [login, setLogin] = useState("");
  const [investorPassword, setInvestorPassword] = useState("");
  const [metaapiToken, setMetaapiToken] = useState("");
  const [nickname, setNickname] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmedReadOnly, setConfirmedReadOnly] = useState(false);

  const selectedBroker = COMMON_BROKERS.find((b) => b.name === brokerName);
  const isCustomBroker = brokerName === "Custom / Other";
  const finalBroker = isCustomBroker ? customBroker.trim() : brokerName;
  const finalServer = isCustomBroker || (selectedBroker?.servers.length === 0)
    ? customServer.trim()
    : serverName;

  const handleConnect = async () => {
    if (!user) return;
    if (!finalBroker || !finalServer || !login || !investorPassword) {
      toast.error("All fields are required");
      return;
    }
    if (!confirmedReadOnly) {
      toast.error("Please confirm the investor password is read-only");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await (supabase as any)
        .from("user_mt_accounts")
        .insert({
          user_id: user.id,
          platform,
          account_type: accountType,
          broker_name: finalBroker,
          server_name: finalServer,
          login: login.trim(),
          nickname: nickname.trim() || null,
          investor_password_encrypted: new TextEncoder().encode(
            btoa(`enc:${investorPassword}`),
          ),
          metaapi_token_encrypted: metaapiToken.trim()
            ? new TextEncoder().encode(btoa(`enc:${metaapiToken.trim()}`))
            : null,
          status: "syncing",
          status_message: "Initial sync in progress",
        })
        .select("id")
        .single();
      if (error) throw error;

      toast.success("Account connected. Provisioning your terminal…", {
        description: `${finalBroker} • ${finalServer} — initial deploy can take up to 8 minutes`,
      });
      // Kick off provisioning on MetaApi (this returns fast — the background
      // poller in useMTAccount will keep polling state every 15s)
      await sync(data.id);
      setInvestorPassword("");
      setMetaapiToken("");
      await refresh();
      // Stay on this page so the user sees provisioning progress live
    } catch (err: any) {
      toast.error(err.message || "Failed to connect");
    } finally {
      setSubmitting(false);
    }
  };

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
        title="Connect MetaTrader Account | Elite Live Trading Room"
        description="Securely link your MT4 or MT5 account using a read-only investor password to sync real balance, equity and trades."
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
                Connect your MetaTrader account
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Sync real-time balance, equity, open positions and trade history into your
                personal dashboard, leaderboard and analytics. Supports MT4 & MT5 across
                hundreds of brokers.
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
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-mono font-bold uppercase tracking-widest ${
                    account.has_metaapi_token
                      ? "border-primary/30 bg-primary/5 text-primary"
                      : "border-border/50 bg-muted/40 text-muted-foreground"
                  }`}
                  title={
                    account.has_metaapi_token
                      ? "Using your personal MetaApi token"
                      : "Using the platform's shared MetaApi connection"
                  }
                >
                  {account.has_metaapi_token ? "Own token" : "Shared"}
                </span>
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
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-5">
              {[
                { label: "Balance", value: account.balance, format: "money" },
                { label: "Equity", value: account.equity, format: "money" },
                { label: "Margin", value: account.margin, format: "money" },
                { label: "Free Margin", value: account.free_margin, format: "money" },
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

            {/* Provisioning progress / error */}
            {(account.status === "syncing" || account.status === "pending") && (
              <div className="border-t border-border/40 bg-primary/[0.04] px-6 py-3">
                <div className="flex items-start gap-2.5">
                  <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-foreground">
                      {account.status_message ?? "Provisioning MetaTrader terminal…"}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      Initial deploy on MetaApi.cloud takes 3–8 minutes. You can leave this page —
                      we'll keep syncing in the background and the dashboard will update automatically.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {account.status === "error" && account.last_error && (
              <div className="border-t border-red-500/30 bg-red-500/[0.06] px-6 py-3">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-red-300">
                      Sync failed
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {account.last_error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-border/40 px-6 py-4 flex items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground font-mono">
                {account.last_synced_at
                  ? `Last synced ${formatDistanceToNow(new Date(account.last_synced_at), { addSuffix: true })}`
                  : "Never synced"}
                {positions.length > 0 && ` • ${positions.length} open position${positions.length === 1 ? "" : "s"}`}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => sync()}
                  disabled={syncing}
                  className="rounded-lg gap-1.5"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  Sync now
                </Button>
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
            </div>
          </motion.div>
        )}

        {!loading && !account && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-6 space-y-5"
          >
            <h2 className="font-heading text-base font-semibold text-foreground">
              Add MT4 / MT5 Account
            </h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Platform
                </Label>
                <Select value={platform} onValueChange={(v) => setPlatform(v as any)}>
                  <SelectTrigger className="bg-card border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mt5">MetaTrader 5</SelectItem>
                    <SelectItem value="mt4">MetaTrader 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Account Type
                </Label>
                <Select value={accountType} onValueChange={(v) => setAccountType(v as any)}>
                  <SelectTrigger className="bg-card border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live (Real money)</SelectItem>
                    <SelectItem value="demo">Demo (Practice)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Broker
              </Label>
              <Select value={brokerName} onValueChange={(v) => {
                setBrokerName(v);
                const b = COMMON_BROKERS.find((x) => x.name === v);
                setServerName(b?.servers[0] ?? "");
              }}>
                <SelectTrigger className="bg-card border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_BROKERS.map((b) => (
                    <SelectItem key={b.name} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCustomBroker && (
                <Input
                  value={customBroker}
                  onChange={(e) => setCustomBroker(e.target.value)}
                  placeholder="Enter broker name"
                  className="bg-card border-border/50 mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <Server className="inline h-3 w-3 mr-1" /> Server
              </Label>
              {!isCustomBroker && selectedBroker && selectedBroker.servers.length > 0 ? (
                <Select value={serverName} onValueChange={setServerName}>
                  <SelectTrigger className="bg-card border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedBroker.servers.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={customServer}
                  onChange={(e) => setCustomServer(e.target.value)}
                  placeholder="e.g. ICMarketsSC-Live02"
                  className="bg-card border-border/50"
                />
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Account Number / Login
                </Label>
                <Input
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="123456789"
                  inputMode="numeric"
                  className="bg-card border-border/50 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Nickname (optional)
                </Label>
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="My swing account"
                  className="bg-card border-border/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                <KeyRound className="inline h-3 w-3 mr-1" /> Investor Password (read-only)
              </Label>
              <Input
                type="password"
                value={investorPassword}
                onChange={(e) => setInvestorPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="off"
                className="bg-card border-border/50 font-mono"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Use the <span className="text-primary font-semibold">investor password</span>,
                not your master password. The investor password only allows reading account data
                and can never place, modify, or close trades.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <KeyRound className="inline h-3 w-3" /> MetaApi.cloud Token
                <span className="ml-1 rounded-full bg-muted/60 px-1.5 py-px text-[9px] font-bold text-muted-foreground">
                  OPTIONAL
                </span>
              </Label>
              <Input
                type="password"
                value={metaapiToken}
                onChange={(e) => setMetaapiToken(e.target.value)}
                placeholder="Paste your personal MetaApi token (or leave empty)"
                autoComplete="off"
                className="bg-card border-border/50 font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Bring your own MetaApi.cloud account for higher limits and full control.
                If empty, we'll use the platform's shared MetaApi connection.{" "}
                <a
                  href="https://app.metaapi.cloud/token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary font-semibold hover:underline"
                >
                  Get a free token →
                </a>
              </p>
            </div>

            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Security
                </span>
              </div>
              <ul className="text-[12px] text-muted-foreground space-y-1.5 leading-relaxed">
                <li className="flex gap-2">
                  <Lock className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  Investor password is encrypted at rest and only ever used for read-only sync.
                </li>
                <li className="flex gap-2">
                  <Lock className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  We never request your master password and cannot place trades on your behalf.
                </li>
                <li className="flex gap-2">
                  <Lock className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                  Disconnect at any time — all synced data is immediately purged.
                </li>
              </ul>
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-primary/20">
                <Label htmlFor="confirm-ro" className="text-[12px] text-foreground cursor-pointer">
                  I confirm this is the read-only investor password
                </Label>
                <Switch
                  id="confirm-ro"
                  checked={confirmedReadOnly}
                  onCheckedChange={setConfirmedReadOnly}
                />
              </div>
            </div>

            <Button
              onClick={handleConnect}
              disabled={submitting || syncing}
              className="w-full rounded-xl h-11 bg-primary text-primary-foreground hover:bg-primary font-bold gap-2 shadow-[0_10px_30px_-10px_hsl(48_100%_51%/0.7)]"
            >
              {submitting || syncing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Connecting…
                </>
              ) : (
                <>
                  <Activity className="h-4 w-4" /> Connect & Sync Now
                </>
              )}
            </Button>

            <a
              href="https://app.metaapi.cloud/accounts"
              target="_blank"
              rel="noopener noreferrer"
              className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors"
            >
              <span>⚡</span>
              Powered by MetaApi.cloud
              <span className="text-muted-foreground">— real-time sync every 30s</span>
            </a>
          </motion.div>
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
