import { useState } from "react";
import { TrendingUp, Hash, Send, Smile, Mic, Plus, Bold, Italic, Code, Link as LinkIcon, Search, Users, Pin, Bell, ChevronDown, AtSign, Image, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";

const channels = [
  { name: "general", unread: 0, category: "Favorites" },
  { name: "trades_room", unread: 1, category: "Channels" },
  { name: "Flowonomics", unread: 0, category: "Channels" },
  { name: "news_and_research", unread: 0, category: "Channels" },
  { name: "el_rincon_del_trader", unread: 1, category: "Channels" },
  { name: "spx_indices", unread: 1, category: "Channels" },
  { name: "crypto", unread: 0, category: "Channels" },
  { name: "commodities", unread: 0, category: "Channels" },
  { name: "bonds_rates", unread: 0, category: "Channels" },
];

const messagesData = [
  {
    id: 1,
    user: "Stelios",
    role: "Admin",
    avatar: "S",
    avatarColor: "bg-teal-600",
    time: "5:04 PM",
    content: 'this "regime change", is it the room with us now?',
    highlight: true,
    reactions: [
      { emoji: "😀", count: 2 },
      { emoji: "😂", count: 2 },
      { emoji: "🤔", count: 1 },
    ],
  },
  {
    id: 2,
    user: "",
    avatar: "",
    avatarColor: "",
    time: "",
    content: "",
    isQuote: true,
    quoteText: "ASKED HOW STRIKING IRANIAN INFRASTRUCTURE WOULD NOT BE A WAR CRIME, TRUMP SAYS: BECAUSE THEY'RE ANIMALS",
  },
  {
    id: 3,
    user: "TraderMike",
    avatar: "T",
    avatarColor: "bg-blue-600",
    time: "5:06 PM",
    content: "I'm sure that's helpful 🙄",
    reactions: [],
  },
  {
    id: 4,
    user: "JoshP",
    avatar: "J",
    avatarColor: "bg-indigo-600",
    time: "5:10 PM",
    content: "",
    hasAttachment: true,
    attachmentTitle: "Last week saw WTI put in its first week of net selling in 14 weeks",
    attachmentFile: "Screenshot 2026-04-06 120950.png (246.13 kB)",
    attachmentDescription: "WTI - Week over Week Flows vs Price analysis showing spec weekly delta and WTI price correlation.",
  },
  {
    id: 5,
    user: "AlexFX",
    avatar: "A",
    avatarColor: "bg-purple-600",
    time: "5:15 PM",
    content: "Great analysis Josh. The flow data is really compelling here. Net selling after 14 weeks of buying is significant.",
    reactions: [{ emoji: "👍", count: 3 }],
  },
  {
    id: 6,
    user: "Stelios",
    role: "Admin",
    avatar: "S",
    avatarColor: "bg-teal-600",
    time: "5:18 PM",
    content: "Agreed. Keep an eye on the $67 support level on WTI. If that breaks, we could see a move down to $64.",
    reactions: [{ emoji: "🎯", count: 4 }],
  },
  {
    id: 7,
    user: "CurrencyKing",
    avatar: "C",
    avatarColor: "bg-orange-600",
    time: "5:22 PM",
    content: "Anyone watching EUR/USD here? The divergence play looks interesting with ECB vs Fed.",
    reactions: [],
  },
];

const Dashboard = () => {
  const [activeChannel, setActiveChannel] = useState("general");
  const [message, setMessage] = useState("");

  const groupedChannels = channels.reduce<Record<string, typeof channels>>((acc, ch) => {
    (acc[ch.category] ??= []).push(ch);
    return acc;
  }, {});

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        {/* Sidebar Header */}
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Link to="/" className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="font-heading text-sm font-bold text-foreground">
              Forex<span className="text-primary">Analytix</span>
            </span>
          </Link>
        </div>

        {/* Sidebar Nav */}
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><Search className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><Users className="h-4 w-4" /></Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground"><AtSign className="h-4 w-4" /></Button>
        </div>

        {/* Channel List */}
        <ScrollArea className="flex-1 px-2 py-2">
          {Object.entries(groupedChannels).map(([category, chs]) => (
            <div key={category} className="mb-3">
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{category}</p>
              {chs.map((ch) => (
                <button
                  key={ch.name}
                  onClick={() => setActiveChannel(ch.name)}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    activeChannel === ch.name
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                  {ch.unread > 0 && (
                    <Badge className="ml-auto h-5 w-5 shrink-0 justify-center rounded-full bg-destructive p-0 text-[10px] text-destructive-foreground">
                      {ch.unread}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          ))}
        </ScrollArea>

        {/* Sidebar Footer */}
        <div className="border-t border-border p-3">
          <Link to="/dashboard">
            <Button variant="outline" size="sm" className="w-full text-xs">
              ← Back to Dashboard
            </Button>
          </Link>
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Channel Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-muted-foreground" />
            <h2 className="font-heading text-base font-semibold text-foreground">{activeChannel}</h2>
            <Badge variant="secondary" className="text-[10px]">★</Badge>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Pin className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Users className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><Search className="h-4 w-4" /></Button>
          </div>
        </header>

        {/* Unread Banner */}
        <div className="flex items-center justify-between bg-primary/10 px-4 py-1.5 text-xs">
          <span className="text-primary">JUMP TO FIRST UNREAD</span>
          <span className="font-medium text-primary">7667 NEW MESSAGES SINCE 03/07/2026</span>
          <span className="cursor-pointer text-primary hover:underline">MARK AS READ</span>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-4 py-4">
          <div className="space-y-4">
            {messagesData.map((msg) => {
              if (msg.isQuote) {
                return (
                  <div key={msg.id} className="ml-12 rounded border-l-2 border-primary/50 bg-muted/30 px-3 py-2">
                    <p className="text-xs font-medium text-primary">{msg.quoteText}</p>
                  </div>
                );
              }

              return (
                <div key={msg.id} className={`group flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/20 ${msg.highlight ? "bg-primary/5" : ""}`}>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${msg.avatarColor} text-sm font-bold text-white`}>
                    {msg.avatar}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground">{msg.user}</span>
                      {msg.role && (
                        <Badge className="bg-primary/20 text-[10px] text-primary">{msg.role}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">{msg.time}</span>
                    </div>

                    {msg.highlight && (
                      <div className="mt-1 rounded bg-[hsl(80,60%,40%)]/80 px-3 py-2">
                        <p className="text-sm text-white">{msg.content}</p>
                      </div>
                    )}

                    {!msg.highlight && msg.content && (
                      <p className="mt-0.5 text-sm text-foreground/90">{msg.content}</p>
                    )}

                    {msg.hasAttachment && (
                      <div className="mt-2 max-w-lg rounded-lg border border-border bg-card p-3">
                        <p className="mb-1 text-sm font-medium text-foreground">{msg.attachmentTitle}</p>
                        <p className="mb-2 text-xs text-muted-foreground">{msg.attachmentFile}</p>
                        <div className="flex h-48 items-center justify-center rounded border border-border/50 bg-muted/30 text-xs text-muted-foreground">
                          <div className="text-center">
                            <Image className="mx-auto mb-1 h-6 w-6 text-primary/50" />
                            <p>{msg.attachmentDescription}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="mt-1.5 flex gap-1">
                        {msg.reactions.map((r, i) => (
                          <button key={i} className="flex items-center gap-1 rounded-full border border-border bg-muted/30 px-2 py-0.5 text-xs hover:bg-muted/50">
                            <span>{r.emoji}</span>
                            <span className="text-muted-foreground">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Hover actions */}
                  <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Smile className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Hash className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="border-t border-border px-4 py-3">
          <div className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-1 border-b border-border/50 px-3 py-1.5">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Bold className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Italic className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><Code className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground"><LinkIcon className="h-3.5 w-3.5" /></Button>
            </div>
            <div className="flex items-center gap-2 px-3 py-2">
              <Smile className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message"
                className="flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <Mic className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
              <Paperclip className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
              <Plus className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
