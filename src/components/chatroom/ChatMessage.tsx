interface ChatMessageProps {
  displayName: string;
  userId: string;
  content: string;
  createdAt: string;
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

/** Render markdown-like content: **bold**, *italic*, `code`, [text](url), ![alt](url) */
const renderContent = (content: string) => {
  // Check for image markdown: ![alt](url)
  const imgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

  const parts: (string | JSX.Element)[] = [];
  let last = 0;
  const combined = /!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  const text = content;
  while ((match = combined.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(renderInline(text.slice(last, match.index)));
    }
    if (match[0].startsWith("!")) {
      // Image
      parts.push(
        <img
          key={match.index}
          src={match[2]}
          alt={match[1]}
          className="mt-1 max-w-xs rounded-lg border border-border cursor-pointer hover:opacity-90"
          onClick={() => window.open(match![2], "_blank")}
        />
      );
    } else {
      // Link
      parts.push(
        <a key={match.index} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-[hsl(45,100%,50%)] underline hover:opacity-80">
          {match[3]}
        </a>
      );
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(renderInline(text.slice(last)));
  return parts;
};

const renderInline = (text: string): JSX.Element => {
  // Bold **text**, italic *text*, code `text`
  const html = text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs font-mono">$1</code>');
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

const ChatMessage = ({ displayName, userId, content, createdAt }: ChatMessageProps) => {
  return (
    <div className="group flex gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/20">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${getColor(userId)} text-sm font-bold text-white`}>
        {getInitial(displayName)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">{displayName}</span>
          <span className="text-xs text-muted-foreground">{formatTime(createdAt)}</span>
        </div>
        <div className="mt-0.5 text-sm text-foreground/90">{renderContent(content)}</div>
      </div>
    </div>
  );
};

export default ChatMessage;
