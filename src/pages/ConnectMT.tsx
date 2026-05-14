import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
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
  Sparkles,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import SEO from "@/components/SEO";
import LanguageSwitcher from "@/components/LanguageSwitcher";

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
};

type Status = "idle" | "testing" | "tested" | "connecting" | "connected" | "error";

const ConnectMT = () => {
  const navigate = useNavigate();
  const [server, setServer] = useState<string>(INFINOX_SERVERS[0]);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"live" | "demo">("live");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [summary, setSummary] = useState<AccountSummary | null>(null);

  const formValid = login.trim().length >= 4 && password.length >= 4 && server;

  const callConnect = async (mode: "test" | "connect") => {
    setErrorMsg("");
    setStatus(mode === "test" ? "testing" : "connecting");
    try {
      const { data, error } = await supabase.functions.invoke("connect-mt5", {
        body: {
          mode,
          broker: "Infinox",
          server,
          login: login.trim(),
          password,
          account_type: accountType,
        },
      });
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || "Unable to connect to your account.");

      setSummary(data.account as AccountSummary);
      if (mode === "test") {
        setStatus("tested");
        toast.success("Connection test successful");
      } else {
        setStatus("connected");
        toast.success("Account connected");
      }
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e?.message || "Something went wrong. Please try again.");
    }
  };

  const reset = () => {
    setStatus("idle");
    setSummary(null);
    setErrorMsg("");
  };

  return (
    <div className="relative min-h-screen bg-background pb-20">
      <SEO
        title="Connect Your Infinox MT5 Account | Elite Live Trading Room"
        description="Securely link your Infinox MT5 account for real-time portfolio sync, copy signals, and direct trade execution from the trading room."
        canonical="https://elitelivetradingroom.com/connect-mt"
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full bg-[hsl(45,100%,50%)]/10 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[380px] w-[380px] rounded-full bg-[hsl(20,90%,50%)]/10 blur-[100px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/85 backdrop-blur-2xl">
        <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm">Dashboard</span>
          </Link>
          <span className="hidden font-heading text-sm font-semibold text-foreground sm:inline">
            Connect <span className="text-primary">Trading Account</span>
          </span>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:py-16">
        {/* Hero */}
        <section className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[hsl(45,100%,50%)]/30 bg-[hsl(45,100%,50%)]/10 px-3 py-1 text-[11px] font-mono uppercase tracking-widest text-[hsl(45,100%,60%)]">
            <Sparkles className="h-3 w-3" />
            Connect Your Infinox MT5 Account
          </span>
          <h1 className="mt-5 font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Link Your Trading Account
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            Connect your existing Infinox MT5 account to enable real-time portfolio sync,
            copy community signals, and execute trades directly from the room.
          </p>
        </section>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-10 rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-2xl shadow-[0_30px_80px_-30px_hsl(45,100%,50%/0.25)] sm:p-8"
        >
          <AnimatePresence mode="wait">
            {(status === "connected" || status === "tested") && summary ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-foreground">
                      {status === "connected"
                        ? "Account Connected Successfully"
                        : "Connection Test Successful"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {status === "connected"
                        ? "Your account is now synced in real-time."
                        : "Credentials verified. Click Connect Account to finish linking."}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 rounded-2xl border border-white/10 bg-background/40 p-5 sm:grid-cols-4">
                  {[
                    {
                      label: "Balance",
                      value: `$${Number(summary.balance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    },
                    {
                      label: "Equity",
                      value: `$${Number(summary.equity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    },
                    { label: "Server", value: summary.server },
                    { label: "Leverage", value: `1:${summary.leverage}` },
                  ].map((m) => (
                    <div key={m.label}>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                        {m.label}
                      </div>
                      <div className="mt-1 truncate font-mono text-sm font-bold text-foreground">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  {status === "tested" ? (
                    <>
                      <Button
                        size="lg"
                        onClick={() => callConnect("connect")}
                        className="w-full bg-[hsl(45,100%,50%)] font-bold text-black hover:bg-[hsl(45,100%,55%)] sm:w-auto"
                      >
                        <Plug className="mr-2 h-4 w-4" />
                        Connect Account
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={reset}
                        className="w-full border-white/15 bg-white/[0.02] sm:w-auto"
                      >
                        Edit Credentials
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="lg"
                      onClick={() => navigate("/dashboard")}
                      className="w-full bg-[hsl(45,100%,50%)] font-bold text-black hover:bg-[hsl(45,100%,55%)] sm:w-auto"
                    >
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Go to Dashboard
                    </Button>
                  )}
                </div>
              </motion.div>
            ) : status === "testing" || status === "connecting" ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center gap-4 py-12 text-center"
              >
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(45,100%,50%)]/10 ring-1 ring-[hsl(45,100%,50%)]/30">
                  <Loader2 className="h-7 w-7 animate-spin text-[hsl(45,100%,60%)]" />
                </div>
                <div>
                  <h2 className="font-heading text-lg font-semibold text-foreground">
                    Connecting to Trading Layer...
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Securely verifying your credentials with Infinox.
                  </p>
                </div>
              </motion.div>
            ) : (
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
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Broker
                  </Label>
                  <Input
                    value="Infinox"
                    disabled
                    className="h-11 cursor-not-allowed border-white/10 bg-white/[0.02] font-medium text-foreground"
                  />
                </div>

                {/* Server */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Server
                  </Label>
                  <Select value={server} onValueChange={setServer}>
                    <SelectTrigger className="h-11 border-white/10 bg-white/[0.02]">
                      <SelectValue placeholder="Select server" />
                    </SelectTrigger>
                    <SelectContent>
                      {INFINOX_SERVERS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Login */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    MT5 Login (Account Number)
                  </Label>
                  <Input
                    inputMode="numeric"
                    placeholder="e.g. 5012345"
                    value={login}
                    onChange={(e) => setLogin(e.target.value.replace(/\s+/g, ""))}
                    className="h-11 border-white/10 bg-white/[0.02] font-mono"
                    autoComplete="off"
                  />
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    MT5 Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Investor or trader password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 border-white/10 bg-white/[0.02] pr-10 font-mono"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Account Type */}
                <div className="space-y-2">
                  <Label className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    Account Type
                  </Label>
                  <RadioGroup
                    value={accountType}
                    onValueChange={(v) => setAccountType(v as "live" | "demo")}
                    className="grid grid-cols-2 gap-3"
                  >
                    {(["live", "demo"] as const).map((type) => (
                      <label
                        key={type}
                        htmlFor={`acct-${type}`}
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 transition ${
                          accountType === type
                            ? "border-[hsl(45,100%,50%)]/60 bg-[hsl(45,100%,50%)]/10"
                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                        }`}
                      >
                        <RadioGroupItem id={`acct-${type}`} value={type} />
                        <span className="text-sm font-semibold capitalize text-foreground">
                          {type}
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                </div>

                {status === "error" && errorMsg && (
                  <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
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
                    className="w-full bg-[hsl(45,100%,50%)] font-bold text-black hover:bg-[hsl(45,100%,55%)] disabled:opacity-50 sm:flex-1"
                  >
                    <Plug className="mr-2 h-4 w-4" />
                    Test Connection
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    disabled
                    className="w-full border-white/15 bg-white/[0.02] disabled:opacity-50 sm:flex-1"
                    title="Run a successful Test Connection first"
                  >
                    Connect Account
                  </Button>
                </div>

                {/* Security note */}
                <div className="flex items-start gap-2 pt-2 text-[11px] leading-relaxed text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[hsl(45,100%,55%)]" />
                  <span>
                    Your credentials are encrypted and stored securely. We use Trading Layer
                    to connect directly to your broker. We never store your password in plain text.
                  </span>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
};

export default ConnectMT;
