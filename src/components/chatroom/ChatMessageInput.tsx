import { useState, useRef, useEffect, useMemo } from "react";
import { Bold, Italic, Code, Link as LinkIcon, Send, Smile, Paperclip, Image, X, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Member {
  user_id: string;
  display_name: string;
}

interface ChatMessageInputProps {
  channelName: string;
  channelId: string | null;
  userId: string | undefined;
  replyTo?: { id: string; displayName: string; content: string } | null;
  onCancelReply?: () => void;
  onSent?: () => void;
  members?: Member[];
}

const ChatMessageInput = ({ channelName, channelId, userId, replyTo, onCancelReply, onSent, members = [] }: ChatMessageInputProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredMembers = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return members.filter((m) => m.display_name.toLowerCase().includes(q)).slice(0, 8);
  }, [mentionQuery, members]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMessage(val);

    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atMatch = textBefore.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionStart(cursor - atMatch[0].length);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (member: Member) => {
    const before = message.slice(0, mentionStart);
    const cursor = inputRef.current?.selectionStart ?? message.length;
    const after = message.slice(cursor);
    const newMsg = `${before}@${member.display_name} ${after}`;
    setMessage(newMsg);
    setMentionQuery(null);
    setTimeout(() => {
      const pos = before.length + member.display_name.length + 2;
      inputRef.current?.setSelectionRange(pos, pos);
      inputRef.current?.focus();
    }, 0);
  };

  const wrapSelection = (prefix: string, suffix: string) => {
    const input = inputRef.current;
    if (!input) return;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const selected = message.slice(start, end);
    const before = message.slice(0, start);
    const after = message.slice(end);
    if (selected) {
      setMessage(`${before}${prefix}${selected}${suffix}${after}`);
    } else {
      setMessage(`${message}${prefix}text${suffix}`);
    }
    setTimeout(() => input.focus(), 0);
  };

  const handleBold = () => wrapSelection("**", "**");
  const handleItalic = () => wrapSelection("*", "*");
  const handleCode = () => wrapSelection("`", "`");
  const handleLink = () => {
    const url = prompt("Enter URL:");
    if (!url) return;
    const input = inputRef.current;
    const start = input?.selectionStart ?? 0;
    const end = input?.selectionEnd ?? 0;
    const selected = message.slice(start, end) || "link";
    const before = message.slice(0, start);
    const after = message.slice(end);
    setMessage(`${before}[${selected}](${url})${after}`);
    setTimeout(() => input?.focus(), 0);
  };

  const uploadFile = async (file: File) => {
    if (!userId || !channelId) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("File must be under 10MB"); return; }
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const isImage = file.type.startsWith("image/");
      const content = isImage ? `![${file.name}](${urlData.publicUrl})` : `[📎 ${file.name}](${urlData.publicUrl})`;
      const { error: msgError } = await supabase.from("messages").insert({ content, channel_id: channelId, user_id: userId });
      if (msgError) throw msgError;
      toast.success("File uploaded!");
    } catch (err: any) { toast.error(err.message || "Upload failed"); }
    finally { setUploading(false); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!message.trim() || !channelId || !userId) return;
    setSending(true);
    const insertData: any = { content: message.trim(), channel_id: channelId, user_id: userId };
    if (replyTo) insertData.reply_to_id = replyTo.id;
    const { error } = await supabase.from("messages").insert(insertData);
    if (error) { toast.error("Failed to send message"); }
    else { setMessage(""); onSent?.(); }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, filteredMembers.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); return; }
      if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return; }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative border-t border-border/50 bg-card/50 backdrop-blur-sm px-4 py-3">
      {/* Reply preview bar */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-xl bg-secondary/50 border border-border/30 px-3 py-2 text-xs">
          <Reply className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">Replying to</span>
          <span className="font-semibold text-foreground">{replyTo.displayName}</span>
          <span className="truncate flex-1 text-muted-foreground">{replyTo.content.slice(0, 60)}</span>
          <button onClick={onCancelReply} className="shrink-0 rounded-lg p-0.5 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* @mention autocomplete dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div ref={dropdownRef} className="absolute bottom-full left-4 right-4 mb-1 max-h-48 overflow-y-auto rounded-xl border border-border/50 bg-card shadow-2xl shadow-background/50 z-50">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase text-muted-foreground tracking-wider">Members</p>
          {filteredMembers.map((m, i) => (
            <button
              key={m.user_id}
              onClick={() => insertMention(m)}
              className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${i === mentionIndex ? "bg-primary/10 text-primary" : "text-foreground hover:bg-secondary/50"}`}
            >
              <span className="font-medium">@{m.display_name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-border/50 bg-card">
        <div className="flex items-center gap-1 border-b border-border/30 px-3 py-1.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleBold} title="Bold"><Bold className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleItalic} title="Italic"><Italic className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleCode} title="Code"><Code className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleLink} title="Link"><LinkIcon className="h-3.5 w-3.5" /></Button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <Smile className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
          <Input
            ref={inputRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="flex-1 border-0 bg-transparent p-0 text-sm text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
          />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <Image className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => imageInputRef.current?.click()} />
          <Paperclip className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" onClick={() => fileInputRef.current?.click()} />
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={handleSend} disabled={sending || uploading || !message.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading file...</p>}
    </div>
  );
};

export default ChatMessageInput;
