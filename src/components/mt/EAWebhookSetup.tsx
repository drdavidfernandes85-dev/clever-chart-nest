import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  KeyRound,
  Lightbulb,
  Loader2,
  Shield,
  Sparkles,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const WEBHOOK_URL = `https://${
  import.meta.env.VITE_SUPABASE_PROJECT_ID
}.supabase.co/functions/v1/mt-webhook`;

type TokenRow = {
  id: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function downloadEA(
  platform: "mt4" | "mt5",
  token: string,
) {
  const url = platform === "mt5" ? "/ea/IX_Sync_EA.mq5" : "/ea/IX_Sync_EA.mq4";
  const res = await fetch(url);
  const tpl = await res.text();
  const filled = tpl
    .split("{{WEBHOOK_URL}}").join(WEBHOOK_URL)
    .split("{{SECRET_TOKEN}}").join(token);
  const blob = new Blob([filled], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = platform === "mt5" ? "IX_Sync_EA.mq5" : "IX_Sync_EA.mq4";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export const EAWebhookSetup = () => {
  const { user } = useAuth();
  const [token, setToken] = useState<TokenRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<"mt4" | "mt5" | null>(null);

  const storageKey = user ? `mt_webhook_raw_token_${user.id}` : null;
  const downloadedKey = user ? `mt_webhook_downloaded_${user.id}` : null;

  const refresh = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("mt_webhook_tokens")
      .select("id, token_prefix, created_at, last_used_at, revoked_at")
      .eq("user_id", user.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setToken(data ?? null);
    if (storageKey) {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setRawToken(stored);
      } else if (data) {
        // No cached raw token but a hashed one exists — auto-rotate so token is always visible
        await createToken();
      } else {
        await createToken();
      }
    }
    if (downloadedKey) {
      const dl = localStorage.getItem(downloadedKey) as "mt4" | "mt5" | null;
      if (dl) setDownloaded(dl);
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const createToken = async () => {
    if (!user) return;
    setCreating(true);
    try {
      await (supabase as any)
        .from("mt_webhook_tokens")
        .update({ revoked_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .is("revoked_at", null);

      const raw = generateToken();
      const hash = await sha256Hex(raw);
      const { data, error } = await (supabase as any)
        .from("mt_webhook_tokens")
        .insert({
          user_id: user.id,
          token_hash: hash,
          token_prefix: raw.slice(0, 8),
        })
        .select("id, token_prefix, created_at, last_used_at, revoked_at")
        .single();
      if (error) throw error;
      setToken(data);
      setRawToken(raw);
      if (storageKey) localStorage.setItem(storageKey, raw);
    } catch (e: any) {
      toast.error(e.message ?? "Could not create token");
    } finally {
      setCreating(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  const onDownload = async (platform: "mt4" | "mt5") => {
    if (!rawToken) {
      toast.error("Token not ready yet — please wait a second.");
      return;
    }
    await downloadEA(platform, rawToken);
    setDownloaded(platform);
    if (downloadedKey) localStorage.setItem(downloadedKey, platform);
    toast.success(`EA for ${platform.toUpperCase()} downloaded`);
  };

  const steps = [
    {
      n: 1,
      title: "Download the Expert Advisor",
      body: "Click the green button below to download the EA file (.mq5 for MT5, or .mq4 for MT4). It's already pre-configured with your webhook URL and token.",
    },
    {
      n: 2,
      title: "Open it in MetaEditor",
      body: "Double-click the downloaded file. MetaEditor (which comes with MT5) will open automatically. If it doesn't, right-click → Open with → MetaEditor.",
    },
    {
      n: 3,
      title: "Check the Webhook URL & Secret Token",
      body: "Inside MetaEditor, scroll to the input parameters at the top. Both fields are already filled — but if needed, copy them again from the boxes below.",
    },
    {
      n: 4,
      title: "Press F7 to compile",
      body: "Hit the F7 key (or click the Compile button). You should see “0 errors” at the bottom. The compiled EA is now ready to run.",
    },
    {
      n: 5,
      title: "Drag the EA onto any chart",
      body: "Go back to MetaTrader 5, open the Navigator (Ctrl+N), find the EA under Expert Advisors, and drag it onto any chart. Allow AutoTrading — done!",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/30">
            <Webhook className="h-5 w-5" />
          </div>
          <div className="space-y-1.5">
            <h3 className="font-heading text-base font-semibold text-foreground">
              Real-time sync via your own Expert Advisor
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Runs directly inside your MT4/MT5 terminal and pushes account &
              positions to your dashboard every 8 seconds.{" "}
              <span className="text-foreground font-medium">
                You only need to do this once. The EA will run automatically after.
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Credentials — moved to top, very prominent */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Your webhook credentials
          </h3>
          {(loading || creating) && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Webhook URL */}
        <div className="space-y-2">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            1. Webhook URL
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={WEBHOOK_URL}
              onFocus={(e) => e.currentTarget.select()}
              className="bg-muted/40 border-border/50 font-mono text-xs h-11"
            />
            <Button
              type="button"
              onClick={() => copy(WEBHOOK_URL, "Webhook URL")}
              className="shrink-0 h-11 gap-2 px-4"
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
        </div>

        {/* Secret Token — always visible */}
        <div className="space-y-2">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            2. Secret Token
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={rawToken ?? "Generating your token…"}
              onFocus={(e) => e.currentTarget.select()}
              className="bg-primary/5 border-primary/40 font-mono text-xs h-11 text-foreground"
            />
            <Button
              type="button"
              onClick={() => rawToken && copy(rawToken, "Secret token")}
              disabled={!rawToken}
              className="shrink-0 h-11 gap-2 px-4"
            >
              <Copy className="h-4 w-4" /> Copy
            </Button>
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
            <Shield className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
            <p className="text-[11px] text-destructive/90 leading-relaxed">
              <span className="font-semibold">Keep this token secret.</span>{" "}
              Anyone with it can send data to your account.
            </p>
          </div>
        </div>
      </div>

      {/* Download buttons */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <h3 className="font-heading text-sm font-semibold text-foreground inline-flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" /> Download Expert Advisor
        </h3>
        <p className="text-xs text-muted-foreground">
          Your URL and secret are baked into the file at download time, so it works out-of-the-box.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Button
            onClick={() => onDownload("mt5")}
            disabled={!rawToken}
            className="rounded-xl gap-2 h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
          >
            <Download className="h-4 w-4" /> Download EA for MT5
          </Button>
          <Button
            onClick={() => onDownload("mt4")}
            disabled={!rawToken}
            variant="outline"
            className="rounded-xl gap-2 h-12"
          >
            <Download className="h-4 w-4" /> Download EA for MT4
          </Button>
        </div>

        {/* Success message after download */}
        {downloaded && (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                EA for {downloaded.toUpperCase()} downloaded successfully!
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Now follow steps 2 → 5 below to install it in MetaTrader. Your
                dashboard will go live within ~10 seconds after you drag the EA
                onto a chart.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5-step setup */}
      <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
        <div className="border-b border-border/40 px-5 py-3 flex items-center justify-between">
          <h3 className="font-heading text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Setup in 5 simple steps
          </h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            ~3 min
          </span>
        </div>
        <ol className="divide-y divide-border/40">
          {steps.map((s) => (
            <li key={s.n} className="flex items-start gap-4 px-5 py-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-mono text-sm font-bold ring-1 ring-primary/30">
                {s.n}
              </span>
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  {s.title}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {s.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Pro tip */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
        <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">Pro tip</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            After compiling, you can minimize MetaTrader 5 — the EA will continue
            working in the background as long as your computer is on and MT5 is running.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EAWebhookSetup;
