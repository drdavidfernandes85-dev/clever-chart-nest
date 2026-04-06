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

/** Parse markdown links/images handling parentheses in URLs */
type Token = { type: "text" | "image" | "link"; text: string; url?: string };

const splitMarkdownLinks = (content: string): Token[] => {
  const tokens: Token[] = [];
  // Match ![alt](url) or [text](url) — find the LAST closing paren that balances
  const regex = /(!\[([^\]]*)\]\(|(?<!!)\[([^\]]+)\]\()/g;
  let last = 0;
  let m;

  while ((m = regex.exec(content)) !== null) {
    const isImage = m[0].startsWith("!");
    const altText = isImage ? m[2] : m[3];
    const urlStart = m.index + m[0].length;

    // Find matching closing paren, accounting for balanced parens in URL
    let depth = 1;
    let i = urlStart;
    while (i < content.length && depth > 0) {
      if (content[i] === "(") depth++;
      else if (content[i] === ")") depth--;
      i++;
    }
    const url = content.slice(urlStart, i - 1);

    if (m.index > last) {
      tokens.push({ type: "text", text: content.slice(last, m.index) });
    }
    tokens.push({ type: isImage ? "image" : "link", text: altText, url });
    last = i;
    regex.lastIndex = i;
  }

  if (last < content.length) {
    tokens.push({ type: "text", text: content.slice(last) });
  }
  return tokens;
};

/** Render markdown-like content: **bold**, *italic*, `code`, [text](url), ![alt](url) */
const renderContent = (content: string) => {
  // Use a greedy URL matcher that handles parentheses in URLs

  // Simple approach: split on image/link patterns manually
  const parts: (string | JSX.Element)[] = [];

  // Match ![alt](url) or [text](url) — use a function that handles balanced parens
  const tokens = splitMarkdownLinks(content);
  tokens.forEach((token, i) => {
    if (token.type === "image") {
      parts.push(
        <img
          key={i}
          src={token.url}
          alt={token.text}
          className="mt-1 max-w-xs rounded-lg border border-border cursor-pointer hover:opacity-90"
          onClick={() => window.open(token.url, "_blank")}
        />
      );
    } else if (token.type === "link") {
      parts.push(
        <a key={i} href={token.url} target="_blank" rel="noopener noreferrer" className="text-[hsl(45,100%,50%)] underline hover:opacity-80">
          {token.text}
        </a>
      );
    } else {
      parts.push(renderInline(token.text));
    }
  });
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
