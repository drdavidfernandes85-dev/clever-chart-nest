import { useEffect, useState } from "react";
import {
  Copy,
  Download,
  KeyRound,
  Loader2,
  Lock,
  Shield,
  Webhook,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

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
  const url = platform === "mt5" ? "/ea/InfinoX_EA_MT5.mq5" : "/ea/InfinoX_EA_MT4.mq4";
  const res = await fetch(url);
  const tpl = await res.text();
  const filled = tpl
    .split("{{WEBHOOK_URL}}").join(WEBHOOK_URL)
    .split("{{SECRET_TOKEN}}").join(token);
  const blob = new Blob([filled], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `InfinoX_EA_${platform.toUpperCase()}.${platform === "mt5" ? "mq5" : "mq4"}`;
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
  // Raw token is only available in-memory immediately after generation.
  const [rawToken, setRawToken] = useState<string | null>(null);

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
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const generate = async () => {
    if (!user) return;
    setCreating(true);
    try {
      // Revoke previous tokens (one active token per user keeps it simple)
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
      toast.success("Webhook token generated", {
        description: "Copy it now — you won't be able to see it again.",
      });
    } catch (e: any) {
      toast.error(e.message ?? "Could not create token");
    } finally {
      setCreating(false);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  const onDownload = async (platform: "mt4" | "mt5") => {
    if (!rawToken) {
      toast.error("Generate a fresh token first — we can't reveal your old one for security.");
      return;
    }
    await downloadEA(platform, rawToken);
    toast.success(`EA for ${platform.toUpperCase()} downloaded`);
  };

  return (
    <div className="space-y-6">
      {/* Intro / why */}
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
              positions to your dashboard every 8 seconds. <span className="text-foreground font-medium">No broker
              credentials leave your computer.</span> 100% free, no MetaApi subscription required.
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="rounded-2xl border border-border/40 bg-card/60 overflow-hidden">
        <div className="border-b border-border/40 px-5 py-3">
          <h3 className="font-heading text-sm font-semibold text-foreground">
            Setup in 4 steps
          </h3>
        </div>
        <ol className="divide-y divide-border/40">
          {[
            {
              n: 1,
              title: "Generate your secret token",
              body: "Creates a unique key that authorises your EA to push data to your account. Keep it private — anyone with this token can write to your dashboard.",
            },
            {
              n: 2,
              title: "Download the Expert Advisor",
              body: "We pre-fill your webhook URL and token inside the .mq4 / .mq5 file so you don't have to edit anything.",
            },
            {
              n: 3,
              title: "Install the EA in MetaTrader",
              body: "MT5: File → Open Data Folder → MQL5 → Experts. Drop the file in, then refresh from the Navigator. MT4: same path under MQL4 → Experts.",
            },
            {
              n: 4,
              title: "Allow WebRequest & attach to a chart",
              body: "Tools → Options → Expert Advisors → enable AutoTrading & WebRequest, then add the Webhook URL to the allowed list. Drag the EA onto any chart — your dashboard goes live in ~10s.",
            },
          ].map((s) => (
            <li key={s.n} className="flex items-start gap-4 px-5 py-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-mono text-xs font-bold ring-1 ring-primary/30">
                {s.n}
              </span>
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-semibold text-foreground">{s.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Credentials */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-heading text-sm font-semibold text-foreground inline-flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Your webhook credentials
          </h3>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : token ? (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={generate}
                disabled={creating}
                className="rounded-lg gap-1.5"
              >
                {creating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Rotate
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={revoke}
                className="rounded-lg gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Revoke
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              onClick={generate}
              disabled={creating}
              className="rounded-lg gap-1.5"
            >
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <KeyRound className="h-3.5 w-3.5" />
              )}
              Generate token
            </Button>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Webhook URL
          </Label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={WEBHOOK_URL}
              className="bg-muted/40 border-border/50 font-mono text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => copy(WEBHOOK_URL, "Webhook URL")}
              className="shrink-0"
              aria-label="Copy webhook URL"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
            Secret Token
          </Label>
          {rawToken ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={rawToken}
                  className="bg-primary/5 border-primary/40 font-mono text-xs text-foreground"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => copy(rawToken, "Secret token")}
                  className="shrink-0"
                  aria-label="Copy secret token"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[11px] text-primary/90 inline-flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                Save this now — for security we won't show it again.
              </p>
            </>
          ) : token ? (
            <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground font-mono">
              <span className="text-foreground">{token.token_prefix}…</span>{" "}
              <span className="opacity-60">(hidden — rotate to reveal a new one)</span>
              {token.last_used_at && (
                <div className="mt-1 text-[10px] text-muted-foreground/80">
                  Last used {formatDistanceToNow(new Date(token.last_used_at), { addSuffix: true })}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border/50 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
              No token yet. Click <span className="text-foreground font-medium">Generate token</span> above to create one.
            </div>
          )}
        </div>
      </div>

      {/* Downloads */}
      <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-4">
        <h3 className="font-heading text-sm font-semibold text-foreground inline-flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" /> Download Expert Advisor
        </h3>
        <p className="text-xs text-muted-foreground">
          Your URL and secret are baked into the file at download time, so the EA works
          out-of-the-box. {!rawToken && (
            <span className="text-primary">Generate a token first to enable downloads.</span>
          )}
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <Button
            onClick={() => onDownload("mt5")}
            disabled={!rawToken}
            className="rounded-xl gap-2 h-11"
          >
            <Download className="h-4 w-4" /> Download EA for MT5
          </Button>
          <Button
            onClick={() => onDownload("mt4")}
            disabled={!rawToken}
            variant="outline"
            className="rounded-xl gap-2 h-11"
          >
            <Download className="h-4 w-4" /> Download EA for MT4
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EAWebhookSetup;
