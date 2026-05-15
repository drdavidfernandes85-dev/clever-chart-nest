import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck,
  Plug,
  LayoutDashboard,
  Server,
  CreditCard,
  TrendingUp,
  Activity,
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";

const INFINOX_SERVERS = [
  "InfinoxLimited-MT5Live",
  "InfinoxLimited-MT5Live2",
  "InfinoxLimited-MT5Live3",
  "InfinoxLimited-MT5Demo",
  "IX-Live",
  "IX-Demo",
];

type AccountSummary = {
  login: string;
  server: string;
  balance: number;
  equity: number;
  leverage: number;
  currency?: string;
  name?: string;
  open_positions?: number;
};

type Status = "loading" | "idle" | "testing" | "tested" | "connecting" | "connected" | "preconnected" | "error";

const ConnectMT = () => {
  const navigate = useNavigate();
  const [server, setServer] = useState<string>(INFINOX_SERVERS[0]);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [traderId, setTraderId] = useState<string | null>(null);
  const [connectedRowId, setConnectedRowId] = useState<string | null>(null);
  const [debugResponse, setDebugResponse] = useState<unknown>(null);
  const [mt5DebugRows, setMt5DebugRows] = useState<unknown>(null);

  const formValid = login.trim().length >= 4 && password.length >= 4 && server;

  // Load any existing connected account on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: ures } = await supabase.auth.getUser();
        const uid = ures?.user?.id;
        if (!uid) {
          if (!cancelled) setStatus("idle");
          return;
        }
        const { data: row } = await supabase
          .from("user_mt_accounts")
          .select("id, login, server_name, balance, equity, currency, leverage, last_synced_at, metaapi_account_id")
          .eq("user_id", uid)
          .eq("status", "connected")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        if (row) {
          setConnectedRowId(row.id);
          setTraderId(row.metaapi_account_id ?? null);
          setSummary({
            login: String(row.login ?? ""),
            server: String(row.server_name ?? ""),
            balance: Number(row.balance ?? 0),
            equity: Number(row.equity ?? 0),
            leverage: Number(row.leverage ?? 0),
            currency: row.currency ?? "USD",
            open_positions: 0,
          });
          setStatus("preconnected");
        } else {
          setStatus("idle");
        }
      } catch {
        if (!cancelled) setStatus("idle");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const disconnect = async () => {
    setIsDisconnecting(true);
    try {
      const { data: ures } = await supabase.auth.getUser();
      const uid = ures?.user?.id;
      if (!uid) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("user_mt_accounts")
        .delete()
        .eq("user_id", uid)
        .eq("status", "connected");
      if (error) throw error;
      setConnectedRowId(null);
      setTraderId(null);
      setSummary(null);
      setPassword("");
      setStatus("idle");
      toast.success("Account disconnected");
    } catch (e: any) {
      toast.error(e?.message || "Failed to disconnect");
    } finally {
      setIsDisconnecting(false);
    }
  };


  const callConnect = async (mode: "test" | "connect") => {
    setErrorMsg("");
    setSummary(null);
    setDebugResponse(null);
    if (mode === "connect") setIsConnecting(true);
    setStatus(mode === "test" ? "testing" : "connecting");
    try {
      const { data, error } = await supabase.functions.invoke("connect-mt5-v2", {
        body: {
          account_number: login.trim(),
          server,
          password,
          mode,
        },
      });

      // Parse error body if Edge Function returned non-2xx
      let payload: any = data;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            payload = await ctx.json();
          } else if (ctx && typeof ctx.text === "function") {
            const txt = await ctx.text();
            try { payload = JSON.parse(txt); } catch { payload = { success: false, error: txt }; }
          }
        } catch {
          // ignore parse failure
        }
      }

      setDebugResponse(payload ?? { success: false, error: error?.message ?? "No response" });

      if (!payload || payload.success !== true || !payload.account) {
        const upstream = payload?.tradingLayerResponse;
        const upstreamStatus = payload?.tradingLayerStatus;
        const isRetryable =
          payload?.retryable === true ||
          upstream?.retryable === true ||
          (typeof upstreamStatus === "number" && upstreamStatus >= 500);

        let msg: string;
        if (isRetryable) {
          const retryAfter = Number(payload?.retryAfter ?? payload?.retry_after ?? upstream?.retry_after ?? upstream?.retryAfter);
          msg = Number.isFinite(retryAfter) && retryAfter > 0
            ? `Trading Layer is temporarily unavailable. Please retry in ${retryAfter} seconds.`
            : "Trading Layer is temporarily unavailable. Please retry shortly.";
        } else if (upstreamStatus === 422) {
          msg = "Invalid credentials. Please check login, password and server.";
        } else {
          msg = payload?.error || error?.message || "Connection failed";
        }
        throw new Error(msg);
      }

      setSummary(payload.account as AccountSummary);
      if (mode === "test") {
        setStatus("tested");
        toast.success("Connection Test Successful");
      } else {
        const tid =
          payload.traderId ||
          payload.trading_layer_trader_id ||
          payload.account?.metaapi_account_id ||
          payload.account?.trading_layer_trader_id ||
          null;
        setTraderId(tid);
        setPassword(""); // never keep password in memory after linking
        setStatus("connected");
        toast.success("Account successfully linked!");

        // Temporary debug: query user's MT5 accounts right after connect succeeds.
        try {
          const { data: ures } = await supabase.auth.getUser();
          const uid = ures?.user?.id;
          if (uid) {
            const { data: rows, error: qErr } = await supabase
              .from("user_mt_accounts")
              .select("user_id, metaapi_account_id, login, server_name, status, last_synced_at")
              .eq("user_id", uid)
              .order("created_at", { ascending: false })
              .limit(5);
            if (qErr) {
              setMt5DebugRows({ error: qErr.message });
            } else {
              setMt5DebugRows(
                (rows ?? []).map((r: any) => ({
                  user_id: r.user_id,
                  trading_layer_trader_id: r.metaapi_account_id,
                  account_number: r.login,
                  server: r.server_name,
                  status: r.status,
                  last_synced: r.last_synced_at,
                })),
              );
            }
          }
        } catch (e: any) {
          setMt5DebugRows({ error: e?.message || String(e) });
        }
      }
    } catch (e: any) {
      setStatus("error");
      setSummary(null);
      setErrorMsg(e?.message || "Connection failed");
      toast.error(e?.message || "Connection failed");
    } finally {
      if (mode === "connect") setIsConnecting(false);
    }
  };

  const reset = () => {
    setStatus("idle");
    setIsConnecting(false);
    setSummary(null);
    setErrorMsg("");
    setDebugResponse(null);
  };

  const metrics = summary
    ? [
        {
          label: "Account Number",
          value: summary.login,
          icon: CreditCard,
        },
        {
          label: "Server",
          value: summary.server,
          icon: Server,
        },
        {
          label: "Balance",
          value: `$${Number(summary.balance).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          icon: TrendingUp,
        },
        {
          label: "Equity",
          value: `$${Number(summary.equity).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`,
          icon: Activity,
        },
        {
          label: "Open Positions",
          value: String(summary.open_positions ?? 0),
          icon: Activity,
        },
      ]
    : [];

  return (
    <div className="relative min-h-screen pb-20" style={{ backgroundColor: "#0F0F0F" }}>
      <SEO
        title="Connect Your Infinox MT5 Account | Elite Live Trading Room"
        description="Securely link your Infinox MT5 account for real-time portfolio sync, copy trade ideas, and direct trade execution from the trading room."
        canonical="https://elitelivetradingroom.com/connect-mt"
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div
          className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full blur-[120px]"
          style={{ backgroundColor: "rgba(255, 205, 5, 0.10)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full blur-[100px]"
          style={{ backgroundColor: "rgba(255, 160, 5, 0.08)" }}
        />
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-white/10 backdrop-blur-2xl"
        style={{ backgroundColor: "rgba(15, 15, 15, 0.85)" }}
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Dashboard</span>
          </Link>
          <span className="hidden font-heading text-sm font-semibold text-white sm:inline">
            Connect <span style={{ color: "#FFCD05" }}>Trading Account</span>
          </span>
          <div className="flex w-auto items-center justify-end">
            {status === "connected" || status === "preconnected" ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest"
                style={{
                  borderColor: "rgba(74, 222, 128, 0.35)",
                  backgroundColor: "rgba(34, 197, 94, 0.12)",
                  color: "#4ade80",
                }}
              >
                <CheckCircle2 className="h-3 w-3" />
                Connected
              </span>
            ) : (
              <span className="block w-10" />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 py-10 sm:py-16">
        {/* Hero */}
        <section className="text-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-mono uppercase tracking-widest"
            style={{
              borderColor: "rgba(255, 205, 5, 0.30)",
              backgroundColor: "rgba(255, 205, 5, 0.10)",
              color: "#FFD75E",
            }}
          >
            <Plug className="h-3 w-3" />
            Connect Your Infinox MT5 Account
          </span>
          <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Link Your Trading Account
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-neutral-400 sm:text-base">
            Connect your existing Infinox MT5 account to enable real-time portfolio sync,
            copy community trade ideas, and execute trades directly from the room.
          </p>
        </section>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mt-10 rounded-3xl border border-white/[0.08] p-6 backdrop-blur-2xl sm:p-8"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.03)",
            boxShadow: "0 30px 80px -30px rgba(255, 205, 5, 0.20)",
          }}
        >
          <AnimatePresence mode="wait">
            {/* === INITIAL LOAD === */}
            {status === "loading" ? (
              <motion.div
                key="loading-init"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-16"
              >
                <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#FFCD05" }} />
              </motion.div>
            ) : /* === ALREADY CONNECTED === */ status === "preconnected" && summary ? (
              <motion.div
                key="preconnected"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.15)",
                      color: "#4ade80",
                      borderColor: "rgba(34, 197, 94, 0.30)",
                    }}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-white">
                      Account Already Connected
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Your Infinox MT5 account is linked to the trading room.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.08] p-4"
                      style={{ backgroundColor: "rgba(0, 0, 0, 0.25)" }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: "rgba(255, 205, 5, 0.12)", color: "#FFCD05" }}
                      >
                        <m.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                          {m.label}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-sm font-bold text-white">
                          {m.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={() => navigate("/trading-dashboard")}
                    className="w-full font-bold text-black hover:brightness-110 sm:w-auto"
                    style={{ backgroundColor: "#FFCD05" }}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Go to Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={disconnect}
                    disabled={isDisconnecting}
                    className="w-full border-white/15 text-white hover:bg-white/[0.06] sm:w-auto"
                  >
                    {isDisconnecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Disconnect Account
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={async () => { await disconnect(); }}
                    disabled={isDisconnecting}
                    className="w-full border-white/15 text-neutral-300 hover:bg-white/[0.06] sm:w-auto"
                  >
                    Switch Account
                  </Button>
                </div>
              </motion.div>
            ) : /* === CONNECTED STATE === */ status === "connected" && summary ? (
              <motion.div
                key="connected"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.15)",
                      color: "#4ade80",
                      borderColor: "rgba(34, 197, 94, 0.30)",
                    }}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-white">
                      Account successfully linked!
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Your Infinox MT5 account is now connected to the trading room.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.filter((m) => m.label !== "Open Positions").map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.08] p-4"
                      style={{ backgroundColor: "rgba(0, 0, 0, 0.25)" }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: "rgba(255, 205, 5, 0.12)",
                          color: "#FFCD05",
                        }}
                      >
                        <m.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                          {m.label}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-sm font-bold text-white">
                          {m.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  size="lg"
                  onClick={() => navigate("/dashboard")}
                  className="w-full font-bold text-black hover:brightness-110 sm:w-auto"
                  style={{
                    backgroundColor: "#FFCD05",
                  }}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Go to Dashboard
                </Button>
              </motion.div>
            ) : /* === TESTED STATE === */ status === "tested" && summary ? (
              <motion.div
                key="tested"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1"
                    style={{
                      backgroundColor: "rgba(34, 197, 94, 0.15)",
                      color: "#4ade80",
                      borderColor: "rgba(34, 197, 94, 0.30)",
                    }}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-white">
                      Connection Test Successful
                    </h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Credentials verified. Click Connect Account to finish linking.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.map((m) => (
                    <div
                      key={m.label}
                      className="flex items-center gap-3 rounded-2xl border border-white/[0.08] p-4"
                      style={{ backgroundColor: "rgba(0, 0, 0, 0.25)" }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{
                          backgroundColor: "rgba(255, 205, 5, 0.12)",
                          color: "#FFCD05",
                        }}
                      >
                        <m.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                          {m.label}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-sm font-bold text-white">
                          {m.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    size="lg"
                    onClick={() => callConnect("connect")}
                    disabled={isConnecting}
                    className="w-full font-bold text-black hover:brightness-110 disabled:opacity-50 sm:w-auto"
                    style={{ backgroundColor: "#FFCD05" }}
                  >
                    {isConnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="mr-2 h-4 w-4" />
                    )}
                    Connect Account
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={reset}
                    className="w-full border-white/15 text-white hover:bg-white/[0.06] sm:w-auto"
                  >
                    Edit Credentials
                  </Button>
                </div>
              </motion.div>
            ) : /* === TESTING / CONNECTING STATE === */ status === "testing" || status === "connecting" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 py-12 text-center"
              >
                <div
                  className="relative flex h-16 w-16 items-center justify-center rounded-2xl ring-1"
                  style={{
                    backgroundColor: "rgba(255, 205, 5, 0.10)",
                    borderColor: "rgba(255, 205, 5, 0.30)",
                  }}
                >
                  <Loader2 className="h-7 w-7 animate-spin" style={{ color: "#FFCD05" }} />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-semibold text-white">
                    {status === "connecting" ? "Connecting Account..." : "Testing Connection..."}
                  </h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    {status === "connecting"
                      ? "Finalizing your account link with Infinox."
                      : "Securely verifying your credentials with Infinox."}
                  </p>
                </div>
              </motion.div>
            ) : /* === FORM STATE === */ (
              <motion.form
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (formValid) callConnect("test");
                }}
                className="space-y-5"
              >
                {/* Broker */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                    Broker
                  </Label>
                  <Input
                    value="Infinox"
                    disabled
                    className="h-11 cursor-not-allowed border-white/10 font-medium text-white"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                  />
                </div>

                {/* Server */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                    Server
                  </Label>
                  <Select value={server} onValueChange={setServer}>
                    <SelectTrigger
                      className="h-11 border-white/10 text-white"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                    >
                      <SelectValue placeholder="Select server" />
                    </SelectTrigger>
                    <SelectContent
                      className="rounded-xl border-white/10"
                      style={{ backgroundColor: "#1a1a1a" }}
                    >
                      {INFINOX_SERVERS.map((s) => (
                        <SelectItem key={s} value={s} className="text-white focus:bg-white/5">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Login */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                    MT5 Login (Account Number)
                  </Label>
                  <Input
                    inputMode="numeric"
                    placeholder="e.g. 5012345"
                    value={login}
                    onChange={(e) => setLogin(e.target.value.replace(/\s+/g, ""))}
                    className="h-11 border-white/10 font-mono text-white"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                    autoComplete="off"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                    MT5 Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Investor or trader password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border-white/10 pr-10 font-mono text-white"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.02)" }}
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-neutral-500 hover:bg-white/5 hover:text-white transition-colors"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {status === "error" && errorMsg && (
                  <div
                    className="flex items-start gap-2.5 rounded-xl border p-3 text-sm"
                    style={{
                      backgroundColor: "rgba(239, 68, 68, 0.10)",
                      borderColor: "rgba(239, 68, 68, 0.30)",
                      color: "#fca5a5",
                    }}
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                  <Button
                    type="submit"
                    size="lg"
                    disabled={!formValid}
                    className="w-full font-bold text-black hover:brightness-110 disabled:opacity-40 sm:flex-1"
                    style={{ backgroundColor: "#FFCD05" }}
                  >
                    <Plug className="mr-2 h-4 w-4" />
                    Test Connection
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    disabled
                    className="w-full border-white/15 text-neutral-500 disabled:opacity-40 sm:flex-1"
                    title="Run a successful Test Connection first"
                  >
                    Connect Account
                  </Button>
                </div>

                {/* Temporary debug: ping edge function */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setDebugResponse({ loading: "trading-layer-health..." });
                    try {
                      const { data, error } = await supabase.functions.invoke(
                        "trading-layer-health",
                        { body: { test: true } },
                      );

                      // Parse error body if Edge Function returned non-2xx
                      let payload: any = data;
                      if (error) {
                        try {
                          const ctx: any = (error as any).context;
                          if (ctx?.json) payload = await ctx.json();
                          else if (ctx?.text) {
                            const t = await ctx.text();
                            try { payload = JSON.parse(t); } catch { payload = { success: false, error: t }; }
                          }
                        } catch { /* ignore */ }
                      }

                      // Validate Trading Layer tenant response (upstream-shaped)
                      const upstream = payload?.upstream ?? payload;
                      const accountId = upstream?.data?.ownerAccount?.accountId;
                      const isSuccess = upstream?.success === true && !!accountId;
                      const upstreamStatus = upstream?.status ?? payload?.status;
                      const isErrorStatus = [401, 403, 404, 500].includes(upstreamStatus);

                      if (!isSuccess || isErrorStatus) {
                        setDebugResponse({
                          success: false,
                          error: payload?.error || upstream?.error || `Invalid response (status: ${upstreamStatus ?? "unknown"})`,
                          upstream: payload,
                        });
                      } else {
                        setDebugResponse({
                          success: true,
                          message: "Trading Layer connected",
                          accountId,
                          raw: payload,
                        });
                      }
                    } catch (e: any) {
                      setDebugResponse({ success: false, error: e?.message || String(e) });
                    }
                  }}
                  className="w-full border-white/15 text-neutral-300 hover:bg-white/[0.06]"
                >
                  Ping Trading Layer Tenant
                </Button>

                {/* Security note */}
                <div className="flex items-start gap-2 pt-2 text-[11px] leading-relaxed text-neutral-500">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: "#FFCD05" }} />
                  <span>
                    Your credentials are encrypted and used only to establish a secure connection
                    via Trading Layer. We never store your password in plain text.
                  </span>
                </div>

                {/* Debug box (temporary) */}
                {debugResponse !== null && (
                  <div
                    className="mt-2 rounded-xl border p-3 text-[11px]"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.4)",
                      borderColor: "rgba(255,255,255,0.08)",
                    }}
                  >
                    <div className="mb-1 font-mono uppercase tracking-widest text-neutral-500">
                      Debug · raw response from trading-layer-health
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-neutral-300">
{JSON.stringify(debugResponse, null, 2)}
                    </pre>
                  </div>
                )}
                {mt5DebugRows !== null && (
                  <div
                    className="mt-2 rounded-xl border p-3 text-[11px]"
                    style={{
                      backgroundColor: "rgba(0,0,0,0.4)",
                      borderColor: "rgba(255,205,5,0.25)",
                    }}
                  >
                    <div className="mb-1 font-mono uppercase tracking-widest text-[#FFCD05]/80">
                      Debug · user_mt5_accounts (latest 5)
                    </div>
                    <pre className="overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-neutral-300">
{JSON.stringify(mt5DebugRows, null, 2)}
                    </pre>
                  </div>
                )}
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default ConnectMT;
