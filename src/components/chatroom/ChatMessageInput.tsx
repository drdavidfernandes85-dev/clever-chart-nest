import { useState, useRef } from "react";
import { Bold, Italic, Code, Link as LinkIcon, Send, Smile, Paperclip, Image, X, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessageInputProps {
  channelName: string;
  channelId: string | null;
  userId: string | undefined;
  replyTo?: { id: string; displayName: string; content: string } | null;
  onCancelReply?: () => void;
  onSent?: () => void;
}

const ChatMessageInput = ({ channelName, channelId, userId, replyTo, onCancelReply, onSent }: ChatMessageInputProps) => {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

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
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }
    setUploading(true);
    try {
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const isImage = file.type.startsWith("image/");
      const content = isImage
        ? `![${file.name}](${urlData.publicUrl})`
        : `[📎 ${file.name}](${urlData.publicUrl})`;
      const { error: msgError } = await supabase.from("messages").insert({
        content,
        channel_id: channelId,
        user_id: userId,
      });
      if (msgError) throw msgError;
      toast.success("File uploaded!");
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!message.trim() || !channelId || !userId) return;
    setSending(true);
    const insertData: any = {
      content: message.trim(),
      channel_id: channelId,
      user_id: userId,
    };
    if (replyTo) insertData.reply_to_id = replyTo.id;

    const { error } = await supabase.from("messages").insert(insertData);
    if (error) {
      toast.error("Failed to send message");
    } else {
      setMessage("");
      onSent?.();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white px-4 py-3">
      {/* Reply preview bar */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 rounded-md bg-gray-50 border border-gray-200 px-3 py-2 text-xs">
          <Reply className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          <span className="text-gray-500">Replying to</span>
          <span className="font-semibold text-gray-700">{replyTo.displayName}</span>
          <span className="truncate flex-1 text-gray-400">{replyTo.content.slice(0, 60)}</span>
          <button onClick={onCancelReply} className="shrink-0 rounded p-0.5 text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-1 border-b border-gray-100 px-3 py-1.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700" onClick={handleBold} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700" onClick={handleItalic} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700" onClick={handleCode} title="Code">
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700" onClick={handleLink} title="Link">
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <Smile className="h-5 w-5 shrink-0 cursor-pointer text-gray-400 hover:text-gray-600" />
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="flex-1 border-0 bg-transparent p-0 text-sm text-gray-900 shadow-none placeholder:text-gray-400 focus-visible:ring-0"
          />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <Image
            className="h-5 w-5 shrink-0 cursor-pointer text-gray-400 hover:text-gray-600"
            onClick={() => imageInputRef.current?.click()}
          />
          <Paperclip
            className="h-5 w-5 shrink-0 cursor-pointer text-gray-400 hover:text-gray-600"
            onClick={() => fileInputRef.current?.click()}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-[hsl(45,100%,50%)]"
            onClick={handleSend}
            disabled={sending || uploading || !message.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {uploading && <p className="mt-1 text-xs text-gray-400">Uploading file...</p>}
    </div>
  );
};

export default ChatMessageInput;
