import { useState, useRef } from "react";
import { Bold, Italic, Code, Link as LinkIcon, Send, Smile, Paperclip, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ChatMessageInputProps {
  channelName: string;
  channelId: string | null;
  userId: string | undefined;
}

const ChatMessageInput = ({ channelName, channelId, userId }: ChatMessageInputProps) => {
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
      const ext = file.name.split(".").pop();
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
    const { error } = await supabase.from("messages").insert({
      content: message.trim(),
      channel_id: channelId,
      user_id: userId,
    });
    if (error) {
      toast.error("Failed to send message");
    } else {
      setMessage("");
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
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-1 border-b border-border/50 px-3 py-1.5">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleBold} title="Bold">
            <Bold className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleItalic} title="Italic">
            <Italic className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleCode} title="Code">
            <Code className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={handleLink} title="Link">
            <LinkIcon className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 px-3 py-2">
          <Smile className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" />
          <Input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channelName}`}
            className="flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
          <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} />
          <Image
            className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
            onClick={() => imageInputRef.current?.click()}
          />
          <Paperclip
            className="h-5 w-5 shrink-0 cursor-pointer text-muted-foreground hover:text-foreground"
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
      {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading file...</p>}
    </div>
  );
};

export default ChatMessageInput;
