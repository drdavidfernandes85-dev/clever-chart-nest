import { useEffect, useRef, useState } from "react";
import { Bot, Send, Sparkles, X, Loader2, ChevronRight, ChevronLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Explain the current EUR/USD move",
  "What's driving XAU/USD right now?",
  "Any high-impact events in the next 4h?",
  "Review my last 5 trades",
  "Suggest a setup for today's London session",
  "Summarize today's room signals",
];

const OPEN_KEY = "infinox.copilot.open";
const COLLAPSED_KEY = "infinox.copilot.collapsed";

interface AICopilotProps {
  /** Render inline as a side panel instead of a floating launcher. */
  embedded?: boolean;
  /** Used in embedded mode to free up horizontal space. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

const AICopilot = ({ embedded = false, collapsed = false, onToggleCollapsed }: AICopilotProps) => {
  const [open, setOpen] = useState<boolean>(() => {
    if (embedded || typeof window === "undefined") return false;
    return localStorage.getItem(OPEN_KEY) === "1";
  });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (embedded || typeof window === "undefined") return;
    localStorage.setItem(OPEN_KEY, open ? "1" : "0");
  }, [open, embedded]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setInput("");
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-copilot`;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      };
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) {
        toast({ title: "Rate limited", description: "Try again in a moment.", variant: "destructive" });
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({
          title: "AI credits exhausted",
          description: "Add credits in Workspace settings.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") {
            streamDone = true;
            break;
          }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      console.error(e);
      toast({ title: "AI error", description: "Could not reach the co-pilot.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const Body = (
    <>
      <ScrollArea className="flex-1 px-4">
        <div ref={scrollRef} className="space-y-4 py-4">
          {messages.length === 0 && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-xl border border-border/40 bg-background/40 px-3 py-2 text-left text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground",
                )}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-headings:my-2 prose-strong:text-foreground">
                    <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                  </div>
                ) : (
                  m.content
                )}
              </div>
            </div>
          ))}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Thinking…</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t border-border/30 p-3"
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="Ask about markets, signals, your trades…"
            rows={1}
            className="min-h-[40px] max-h-32 resize-none rounded-xl bg-background/50 text-sm"
            disabled={loading}
          />
          <Button type="submit" size="icon" disabled={loading || !input.trim()} className="rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </>
  );

  // ── Embedded (in-page side panel) ─────────────────────────────────────────
  if (embedded) {
    if (collapsed) {
      return (
        <aside className="hidden xl:flex w-12 shrink-0 flex-col items-center gap-2 border-l border-border/50 bg-card/40 py-3">
          <button
            onClick={onToggleCollapsed}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
            aria-label="Expand AI Co-pilot"
            title="Expand AI Co-pilot"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span
            className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground"
            style={{ writingMode: "vertical-rl" }}
          >
            AI Co-pilot
          </span>
        </aside>
      );
    }
    return (
      <aside className="hidden xl:flex w-[360px] shrink-0 flex-col border-l border-border/50 bg-card/40">
        <header className="flex items-center justify-between border-b border-border/30 p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-heading text-xs font-semibold text-foreground">AI Co-pilot</h3>
              <p className="text-[10px] text-muted-foreground">Knows your trades, signals & news</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleCollapsed}
            aria-label="Collapse AI Co-pilot"
            title="Collapse"
            className="h-8 w-8"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </header>
        {Body}
      </aside>
    );
  }

  // ── Floating launcher (default, used on Dashboard / Live Chart) ───────────
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex h-14 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground shadow-2xl shadow-primary/40 transition-all hover:scale-105 hover:shadow-primary/60"
          aria-label="Open AI Co-pilot"
        >
          <Sparkles className="h-5 w-5" />
          <span className="font-semibold text-sm">AI Co-pilot</span>
        </button>
      )}

      <div
        className={cn(
          "fixed bottom-0 right-0 z-50 flex h-[min(640px,90vh)] w-full max-w-md flex-col rounded-t-3xl border border-border/40 bg-card/95 backdrop-blur-2xl shadow-2xl transition-transform duration-300 sm:bottom-6 sm:right-6 sm:rounded-3xl",
          open ? "translate-y-0" : "translate-y-[120%]",
        )}
      >
        <header className="flex items-center justify-between border-b border-border/30 p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-heading text-sm font-semibold text-foreground">AI Co-pilot</h3>
              <p className="text-[10px] text-muted-foreground">Knows your trades, signals & news</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>
        {Body}
      </div>
    </>
  );
};

export default AICopilot;
