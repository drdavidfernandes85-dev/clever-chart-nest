import { CheckCircle2, Reply, Heart, Flame, ThumbsUp } from "lucide-react";

/**
 * Static sample messages that surface when a channel has no real history yet.
 * Purely presentational — no DB writes — so the room never feels empty.
 */

interface SampleMsg {
  id: string;
  user: string;
  initials: string;
  color: string;
  verified?: boolean;
  mentor?: boolean;
  minutesAgo: number;
  content: string;
  reactions?: { emoji: string; count: number; mine?: boolean }[];
  replies?: number;
}

const SAMPLE: SampleMsg[] = [
  {
    id: "s1",
    user: "IX_Mentor",
    initials: "IX",
    color: "bg-primary/30 text-primary",
    verified: true,
    mentor: true,
    minutesAgo: 22,
    content:
      "📊 **EUR/USD** broke 1.0850 with conviction on the 4H. Watching for a clean retest before adding to longs. Stops below 1.0820.",
    reactions: [
      { emoji: "🔥", count: 14, mine: true },
      { emoji: "👍", count: 9 },
    ],
    replies: 3,
  },
  {
    id: "s2",
    user: "df23fx",
    initials: "DF",
    color: "bg-blue-600 text-foreground",
    verified: true,
    minutesAgo: 18,
    content:
      "Just took +32 pips on the EU long 🎉 partials secured, runner trailing at BE. Thanks @IX_Mentor for the call.",
    reactions: [
      { emoji: "🚀", count: 11 },
      { emoji: "💯", count: 6 },
    ],
  },
  {
    id: "s3",
    user: "desk-trader",
    initials: "DT",
    color: "bg-indigo-600 text-foreground",
    minutesAgo: 14,
    content: "Anyone watching XAU/USD here? 2412 looks like a juicy liquidity sweep before NY open.",
    reactions: [{ emoji: "👀", count: 7 }],
    replies: 2,
  },
  {
    id: "s4",
    user: "pip_hunter",
    initials: "PH",
    color: "bg-purple-600 text-foreground",
    minutesAgo: 11,
    content: "GBP/JPY printing a textbook double top. Short triggered, SL above 192.80, TP at 191.40.",
    reactions: [
      { emoji: "🔥", count: 5 },
      { emoji: "❤️", count: 3 },
    ],
  },
  {
    id: "s5",
    user: "scalper.lab",
    initials: "SL",
    color: "bg-orange-600 text-foreground",
    minutesAgo: 8,
    content: "lol the algos really hate this NFP week 😂 keep size small fam",
    reactions: [
      { emoji: "😂", count: 12 },
      { emoji: "💯", count: 4 },
    ],
  },
  {
    id: "s6",
    user: "EUR_King",
    initials: "EK",
    color: "bg-pink-600 text-foreground",
    verified: true,
    minutesAgo: 6,
    content:
      "Question for the room — anyone running a higher TF bias confirmation script in TradingView? Looking to combine with the room's signals.",
    replies: 4,
  },
  {
    id: "s7",
    user: "IX_Mentor",
    initials: "IX",
    color: "bg-primary/30 text-primary",
    verified: true,
    mentor: true,
    minutesAgo: 4,
    content:
      "Heads up: **US PMI** in 30 minutes ⏰. Tighten stops on USD pairs and consider closing scalps before the print.",
    reactions: [
      { emoji: "👍", count: 18, mine: true },
      { emoji: "🔥", count: 7 },
    ],
  },
  {
    id: "s8",
    user: "alpha-rat",
    initials: "AR",
    color: "bg-cyan-600 text-foreground",
    minutesAgo: 3,
    content: "Closed BTC long for +1.4R 🎯 next setup forming on ETH/USD around 3,420.",
    reactions: [{ emoji: "🚀", count: 9 }],
  },
  {
    id: "s9",
    user: "df23fx",
    initials: "DF",
    color: "bg-blue-600 text-foreground",
    verified: true,
    minutesAgo: 2,
    content: "@EUR_King yes, I run a custom HTF confluence indicator — happy to share it in #resources.",
    reactions: [{ emoji: "❤️", count: 5 }],
  },
  {
    id: "s10",
    user: "desk-trader",
    initials: "DT",
    color: "bg-indigo-600 text-foreground",
    minutesAgo: 1,
    content: "GG everyone, green day on the books ✅ logging off for the London close. See you tomorrow.",
    reactions: [
      { emoji: "🔥", count: 8 },
      { emoji: "💯", count: 3 },
    ],
  },
];

const formatRel = (mins: number) => {
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
};

const renderInline = (text: string) => {
  // Bold **text**, mentions @name
  const parts: (string | JSX.Element)[] = [];
  const regex = /(\*\*[^*]+\*\*|@\w+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("**")) {
      parts.push(<strong key={key++} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <span key={key++} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
          {tok}
        </span>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
};

const ReactionPill = ({ emoji, count, mine }: { emoji: string; count: number; mine?: boolean }) => (
  <button
    className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs transition-colors ${
      mine
        ? "border-primary/50 bg-primary/15 text-foreground"
        : "border-border/40 bg-secondary/40 text-muted-foreground hover:bg-secondary"
    }`}
  >
    <span>{emoji}</span>
    <span className="font-semibold">{count}</span>
  </button>
);

const SampleMessages = () => {
  return (
    <div className="space-y-0">
      {SAMPLE.map((m, i) => (
        <div
          key={m.id}
          className="group relative flex gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-secondary/30 animate-fade-in"
          style={{ animationDelay: `${i * 60}ms`, animationFillMode: "both" }}
        >
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${m.color}`}>
            {m.initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-foreground">{m.user}</span>
              {m.verified && (
                <span
                  className="inline-flex items-center gap-0.5 rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary"
                  title="Verified Trader"
                >
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Verified
                </span>
              )}
              {m.mentor && (
                <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-foreground">
                  Mentor
                </span>
              )}
              <span className="text-xs text-muted-foreground">{formatRel(m.minutesAgo)}</span>
            </div>
            <div className="text-sm text-secondary-foreground leading-relaxed">{renderInline(m.content)}</div>
            {(m.reactions?.length || m.replies) && (
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {m.reactions?.map((r) => (
                  <ReactionPill key={r.emoji} {...r} />
                ))}
                {m.replies && (
                  <button className="flex items-center gap-1 rounded-md border border-border/40 bg-secondary/40 px-1.5 py-0.5 text-[11px] font-semibold text-primary hover:bg-secondary">
                    <Reply className="h-3 w-3" />
                    {m.replies} replies
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="absolute -top-3 right-2 hidden gap-0.5 rounded-xl border border-border/50 bg-card p-0.5 shadow-lg group-hover:flex">
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Like">
              <ThumbsUp className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Love">
              <Heart className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Fire">
              <Flame className="h-3.5 w-3.5" />
            </button>
            <button className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Reply">
              <Reply className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default SampleMessages;
