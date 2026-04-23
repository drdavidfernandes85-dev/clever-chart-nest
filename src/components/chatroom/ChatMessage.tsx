import { useState } from "react";
import { Link } from "react-router-dom";
import { Reply, Pencil, Trash2, Check, X } from "lucide-react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MessageReactions from "./MessageReactions";

export interface ChatMessageProps {
  id: string;
  displayName: string;
  userId: string;
  content: string;
  createdAt: string;
  role?: string;
  isGrouped?: boolean;
  currentUserId?: string;
  replyTo?: { displayName: string; content: string } | null;
  onReply?: (messageId: string, displayName: string, content: string) => void;
  onMessageUpdate?: () => void;
}

const getInitial = (name: string) => name.charAt(0).toUpperCase();

const getColor = (userId: string) => {
  const colors = ["bg-teal-600", "bg-blue-600", "bg-indigo-600", "bg-purple-600", "bg-orange-600", "bg-pink-600", "bg-cyan-600"];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const formatTime = (dateStr: string) =>
  new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type Token = { type: "text" | "image" | "link"; text: string; url?: string };

const splitMarkdownLinks = (content: string): Token[] => {
  const tokens: Token[] = [];
  const regex = /(!\[([^\]]*)\]\(|(?<!!)\[([^\]]+)\]\()/g;
  let last = 0;
  let m;
  while ((m = regex.exec(content)) !== null) {
    const isImage = m[0].startsWith("!");
    const altText = isImage ? m[2] : m[3];
    const urlStart = m.index + m[0].length;
    let depth = 1;
    let i = urlStart;
    while (i < content.length && depth > 0) {
      if (content[i] === "(") depth++;
      else if (content[i] === ")") depth--;
      i++;
    }
    const url = content.slice(urlStart, i - 1);
    if (m.index > last) tokens.push({ type: "text", text: content.slice(last, m.index) });
    tokens.push({ type: isImage ? "image" : "link", text: altText, url });
    last = i;
    regex.lastIndex = i;
  }
  if (last < content.length) tokens.push({ type: "text", text: content.slice(last) });
  return tokens;
};

const renderContent = (content: string) => {
  const parts: (string | JSX.Element)[] = [];
  const tokens = splitMarkdownLinks(content);
  tokens.forEach((token, i) => {
    if (token.type === "image") {
      parts.push(
        <img key={i} src={token.url} alt={token.text}
          className="mt-1 max-w-xs rounded-xl border border-border/30 cursor-pointer hover:opacity-90"
          onClick={() => window.open(token.url, "_blank")} />
      );
    } else if (token.type === "link") {
      parts.push(
        <a key={i} href={token.url} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{token.text}</a>
      );
    } else {
      const safeHtml = DOMPurify.sanitize(renderInline(token.text), {
        ALLOWED_TAGS: ["strong", "em", "code", "span"],
        ALLOWED_ATTR: ["class"],
      });
      parts.push(<span key={i} dangerouslySetInnerHTML={{ __html: safeHtml }} />);
    }
  });
  return parts;
};

const renderInline = (text: string): string => {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded-md bg-secondary px-1.5 py-0.5 text-xs font-mono text-foreground">$1</code>')
    .replace(/@(\w+)/g, '<span class="rounded-md bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary cursor-pointer">@$1</span>');
};

const RoleBadge = ({ role }: { role?: string }) => {
  if (!role || role === "user") return null;
  const isAdmin = role === "admin";
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-foreground ${isAdmin ? "bg-emerald-600" : "bg-blue-600"}`}>
      {role}
    </span>
  );
};

const ChatMessage = ({
  id, displayName, userId, content, createdAt, role,
  isGrouped, currentUserId, replyTo, onReply, onMessageUpdate
}: ChatMessageProps) => {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const isOwn = currentUserId === userId;

  const handleDelete = async () => {
    if (!confirm("Delete this message?")) return;
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) toast.error("Failed to delete");
    else onMessageUpdate?.();
  };

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    const { error } = await supabase.from("messages").update({ content: editContent.trim() }).eq("id", id);
    if (error) toast.error("Failed to edit");
    else { setEditing(false); onMessageUpdate?.(); }
  };

  if (editing) {
    return (
      <div className="flex gap-3 px-2 py-1.5 bg-primary/5 rounded-xl">
        <div className="w-9 shrink-0" />
        <div className="flex-1 min-w-0">
          <input
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleEditSave(); if (e.key === "Escape") setEditing(false); }}
            className="w-full rounded-xl border border-border bg-secondary px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            autoFocus
          />
          <div className="mt-1 flex gap-1">
            <button onClick={handleEditSave} className="rounded-lg bg-emerald-600 p-1 text-foreground hover:bg-emerald-700"><Check className="h-3 w-3" /></button>
            <button onClick={() => setEditing(false)} className="rounded-lg bg-secondary p-1 text-muted-foreground hover:bg-muted"><X className="h-3 w-3" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative flex gap-3 rounded-xl px-2 transition-colors hover:bg-secondary/30 ${isGrouped ? "py-0.5" : "py-2"}`}>
      {isGrouped ? (
        <div className="flex w-9 shrink-0 items-center justify-center">
          <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            {formatTime(createdAt)}
          </span>
        </div>
      ) : (
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${getColor(userId)} text-sm font-bold text-foreground`}>
          {getInitial(displayName)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        {replyTo && (
          <div className="mb-1 flex items-center gap-2 rounded-lg bg-secondary/50 px-2 py-1 text-xs text-muted-foreground border-l-2 border-primary/30">
            <Reply className="h-3 w-3 shrink-0 rotate-180" />
            <span className="font-semibold text-foreground">{replyTo.displayName}</span>
            <span className="truncate">{replyTo.content}</span>
          </div>
        )}

        {!isGrouped && (
          <div className="flex items-center gap-2">
            <Link to={`/u/${userId}`} className="text-sm font-bold text-foreground hover:text-primary transition-colors">
              {displayName}
            </Link>
            <RoleBadge role={role} />
            <span className="text-xs text-muted-foreground">{formatTime(createdAt)}</span>
          </div>
        )}

        <div className="text-sm text-secondary-foreground leading-relaxed">{renderContent(content)}</div>
        <MessageReactions messageId={id} />
      </div>

      {/* Hover action buttons */}
      <div className="absolute -top-3 right-2 hidden gap-0.5 rounded-xl border border-border/50 bg-card p-0.5 shadow-lg group-hover:flex">
        {onReply && (
          <button onClick={() => onReply(id, displayName, content)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Reply">
            <Reply className="h-3.5 w-3.5" />
          </button>
        )}
        {isOwn && (
          <>
            <button onClick={() => { setEditing(true); setEditContent(content); }} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Edit">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleDelete} className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" title="Delete">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ChatMessage;
