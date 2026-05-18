import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mt5Api, type AccountInfo, type Tick } from "./mt5TerminalApi";
import "./TradingTerminal.css";

type LogEntry = { time: string; message: string; tone: "info" | "ok" | "bad" };

const FALLBACK_QUOTES: Tick[] = [
  { symbol: "EURUSD", bid: 1.07179, ask: 1.07189, last: 1.07184, changePct: -0.09, spread: 0.0001, digits: 5, time: "" },
  { symbol: "GBPUSD", bid: 1.23421, ask: 1.23434, last: 1.23428, changePct: 0.18, spread: 0.00013, digits: 5, time: "" },
  { symbol: "XAUUSD", bid: 2418.14, ask: 2418.72, last: 2418.43, changePct: 0.42, spread: 0.58, digits: 2, time: "" },
  { symbol: "BTCUSD", bid: 66771.40, ask: 66783.20, last: 66777.30, changePct: 1.18, spread: 11.8, digits: 2, time: "" },
  { symbol: "USATEC", bid: 14260.55, ask: 14261.40, last: 14260.97, changePct: 2.18, spread: 0.85, digits: 2, time: "" },
  { symbol: "AAPL", bid: 175.07, ask: 175.09, last: 175.08, changePct: 1.21, spread: 0.02, digits: 2, time: "" },
  { symbol: "AMZN", bid: 120.74, ask: 120.76, last: 120.75, changePct: 5.0, spread: 0.02, digits: 2, time: "" },
  { symbol: "BRENT", bid: 76.87, ask: 76.91, last: 76.89, changePct: 1.17, spread: 0.04, digits: 2, time: "" },
];

function fmt(value: number, digits = 2) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  });
}
function money(v: number) { return `$ ${fmt(v, 2)}`; }
function splitPrice(value: number, digits = 2) {
  const text = fmt(value, digits);
  const dot = text.lastIndexOf(".");
  if (dot === -1) return { head: text, tail: "" };
  return { head: text.slice(0, Math.max(dot + 1, text.length - 2)), tail: text.slice(Math.max(dot + 1, text.length - 2)) };
}
function seededSeries(length: number, seed: number, trend = 0) {
  let v = seed; const out: number[] = [];
  for (let i = 0; i < length; i++) {
    v += (Math.sin(i * .47) + Math.cos(i * .19)) * 0.35 + trend + (Math.random() - .48) * 1.2;
    out.push(v);
  }
  return out;
}
function demoCandles(last: number) {
  const candles: { open: number; high: number; low: number; close: number }[] = [];
  let close = last * .96;
  for (let i = 0; i < 92; i++) {
    const open = close + (Math.random() - .48) * last * .006;
    close = open + (Math.sin(i * .22) + .8) * last * .0015 + (Math.random() - .5) * last * .005;
    const high = Math.max(open, close) + Math.random() * last * .004;
    const low = Math.min(open, close) - Math.random() * last * .004;
    candles.push({ open, high, low, close });
  }
  return candles;
}

function drawSpark(canvas: HTMLCanvasElement, up: boolean) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
  const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
  const data = seededSeries(36, 20 + Math.random() * 10, up ? .1 : -.08);
  const min = Math.min(...data), max = Math.max(...data);
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#3b3f40"; ctx.beginPath();
  ctx.moveTo(0, h * .72); ctx.lineTo(w, h * .72); ctx.stroke();
  ctx.strokeStyle = up ? "#0eb879" : "#e23b32"; ctx.lineWidth = 1.5 * dpr; ctx.beginPath();
  data.forEach((p, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h * .82 - h * .08;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function drawMini(canvas: HTMLCanvasElement, up: boolean) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
  const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
  const data = seededSeries(64, 35 + Math.random() * 20, up ? .12 : -.05);
  const min = Math.min(...data), max = Math.max(...data);
  ctx.fillStyle = "#101212"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.12)"; ctx.setLineDash([2 * dpr, 3 * dpr]);
  ctx.beginPath(); ctx.moveTo(0, h * .5); ctx.lineTo(w, h * .5); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "#555b5d"; ctx.lineWidth = dpr; ctx.beginPath();
  data.forEach((p, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h * .82 - h * .08;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = up ? "#09b673" : "#e23b32"; ctx.lineWidth = 1.7 * dpr; ctx.beginPath();
  data.slice(-16).forEach((p, idx) => {
    const i = data.length - 16 + idx;
    const x = (i / (data.length - 1)) * w;
    const y = h - ((p - min) / (max - min || 1)) * h * .82 - h * .08;
    idx ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
}

function drawMainChart(canvas: HTMLCanvasElement, candles: { open: number; high: number; low: number; close: number }[], digits: number) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.width = Math.max(1, canvas.clientWidth * dpr);
  const h = canvas.height = Math.max(1, canvas.clientHeight * dpr);
  const pad = { left: 10 * dpr, right: 78 * dpr, top: 16 * dpr, bottom: 35 * dpr };
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#090a0a"; ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = "rgba(255,255,255,.075)";
  for (let i = 0; i < 9; i++) {
    const y = pad.top + i * ((h - pad.top - pad.bottom) / 8);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const x = i * ((w - pad.right) / 7);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h - pad.bottom); ctx.stroke();
  }
  if (!candles.length) return;
  const min = Math.min(...candles.map(c => c.low));
  const max = Math.max(...candles.map(c => c.high));
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const xStep = plotW / candles.length;
  const yFor = (v: number) => pad.top + (max - v) / (max - min || 1) * plotH;
  candles.forEach((c, i) => {
    const x = pad.left + i * xStep + xStep * .5;
    const yO = yFor(c.open), yC = yFor(c.close), yH = yFor(c.high), yL = yFor(c.low);
    const up = c.close >= c.open;
    ctx.strokeStyle = up ? "#32d39a" : "#ff3e3a";
    ctx.fillStyle = up ? "#21bd86" : "#e52e2c";
    ctx.lineWidth = Math.max(1, dpr);
    ctx.beginPath(); ctx.moveTo(x, yH); ctx.lineTo(x, yL); ctx.stroke();
    ctx.fillRect(x - xStep * .28, Math.min(yO, yC), xStep * .56, Math.max(3 * dpr, Math.abs(yC - yO)));
  });
  ctx.fillStyle = "#d3d7d8"; ctx.font = `${11 * dpr}px Segoe UI, Arial`; ctx.textAlign = "right";
  for (let i = 0; i < 6; i++) {
    const value = max - i * ((max - min) / 5);
    ctx.fillText(fmt(value, digits), w - 8 * dpr, pad.top + i * (plotH / 5) + 4 * dpr);
  }
}

export default function TradingTerminal() {
  const [connected, setConnected] = useState(false);
  const [connText, setConnText] = useState("Connecting to MT5 API");
  const [symbols, setSymbols] = useState<string[]>(
    Array.from(new Set([...mt5Api.symbols, ...FALLBACK_QUOTES.map(q => q.symbol)])).slice(0, 10)
  );
  const [selected, setSelected] = useState("EURUSD");
  const [quotes, setQuotes] = useState<Map<string, Tick>>(new Map(FALLBACK_QUOTES.map(q => [q.symbol, q])));
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [accountId, setAccountId] = useState("");
  const [clock, setClock] = useState("--:--:--");
  const [ticketQty, setTicketQty] = useState("0.20");
  const [ticketPrice, setTicketPrice] = useState("0.00");
  const [bracket, setBracket] = useState("none");
  const [log, setLog] = useState<LogEntry[]>([]);
  const [layout, setLayout] = useState("1");
  const [candles, setCandles] = useState<{ open: number; high: number; low: number; close: number }[]>([]);

  const chartRef = useRef<HTMLCanvasElement>(null);
  const watchListRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLDivElement>(null);

  const currentQuote = useMemo<Tick>(
    () => quotes.get(selected) || FALLBACK_QUOTES.find(q => q.symbol === selected) || FALLBACK_QUOTES[0],
    [quotes, selected]
  );

  const logTrade = useCallback((message: string, tone: LogEntry["tone"] = "info") => {
    const time = new Date().toLocaleTimeString([], { hour12: false });
    setLog(prev => [{ time, message, tone }, ...prev].slice(0, 6));
  }, []);

  // Clock
  useEffect(() => {
    const id = setInterval(() => {
      setClock(new Date().toLocaleString([], {
        month: "2-digit", day: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      }));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Refresh quotes
  const refreshQuotes = useCallback(async (symList: string[]) => {
    try {
      const { ticks } = await mt5Api.ticks(symList);
      setQuotes(prev => {
        const next = new Map(prev);
        ticks.forEach(t => next.set(t.symbol, t));
        return next;
      });
      setConnected(true);
      setConnText("MT5 Infinox live data");
    } catch (e: any) {
      setConnected(false);
      setConnText(mt5Api.lastError || "MT5 API unavailable");
    }
  }, []);

  // Refresh account
  const refreshAccount = useCallback(async () => {
    try {
      const data = await mt5Api.accounts();
      setAccounts(data.accounts);
      if (data.accounts[0]) setAccountId(String(data.accounts[0].id));
    } catch {
      setAccounts([]);
    }
  }, []);

  // Refresh symbols
  const refreshSymbols = useCallback(async () => {
    try {
      const live = await mt5Api.symbolsList();
      if (live.length) {
        const next = Array.from(new Set(live)).slice(0, 10);
        setSymbols(next);
      }
    } catch { /* keep current */ }
  }, []);

  // Bootstrap + polling
  const bootstrap = useCallback(async () => {
    setConnected(false); setConnText("Connecting to MT5 API");
    await refreshSymbols();
    await refreshAccount();
    await refreshQuotes(symbols);
  }, [refreshSymbols, refreshAccount, refreshQuotes, symbols]);

  useEffect(() => { bootstrap(); /* once */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => refreshQuotes(symbols), 5000);
    return () => clearInterval(id);
  }, [symbols, refreshQuotes]);

  // Candles per selected
  useEffect(() => { setCandles(demoCandles(currentQuote.last || 100)); }, [selected]); // eslint-disable-line

  // Draw main chart
  useEffect(() => {
    if (chartRef.current) drawMainChart(chartRef.current, candles, currentQuote.digits);
  }, [candles, currentQuote]);

  useEffect(() => {
    const onResize = () => {
      if (chartRef.current) drawMainChart(chartRef.current, candles, currentQuote.digits);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [candles, currentQuote]);

  // Sparks
  useEffect(() => {
    if (!watchListRef.current) return;
    watchListRef.current.querySelectorAll<HTMLCanvasElement>(".spark").forEach((c, i) => {
      const q = quotes.get(symbols[i]);
      drawSpark(c, (q?.changePct ?? 0) >= 0);
    });
  }, [symbols, quotes]);

  useEffect(() => {
    if (!miniRef.current) return;
    miniRef.current.querySelectorAll<HTMLCanvasElement>(".mini-card canvas").forEach((c, i) => {
      const q = quotes.get(symbols[i]);
      drawMini(c, (q?.changePct ?? 0) >= 0);
    });
  }, [symbols, quotes]);

  // Update ticket price when symbol changes
  useEffect(() => {
    setTicketPrice(fmt(currentQuote.ask, currentQuote.digits));
  }, [selected]); // eslint-disable-line

  const total = useMemo(() => money(Number(ticketQty || 0) * currentQuote.ask), [ticketQty, currentQuote]);

  const submitOrder = useCallback(async (kind: string, symbol: string, qty: string, source: string) => {
    const [side, orderType] = kind.split("-");
    try {
      await mt5Api.order({
        symbol, side: side as "buy" | "sell", orderType,
        volume: Number(qty),
        signalId: `terminal-${Date.now()}`,
      });
      logTrade(`${side.toUpperCase()} ${orderType} sent: ${symbol} ${qty}`, "ok");
    } catch (e: any) {
      logTrade(`Order rejected: ${e.message}`, "bad");
    }
  }, [logTrade]);

  const submitAction = useCallback(async (action: string, symbol: string) => {
    try {
      if (action === "close") (mt5Api as any).close();
      else if (action === "cancel") (mt5Api as any).cancel();
      else if (action === "invert") (mt5Api as any).invert();
      else if (action === "cancel-close") (mt5Api as any).cancelAndClose();
      logTrade(`${action} sent: ${symbol}`, "ok");
    } catch (e: any) {
      logTrade(`${action} failed: ${e.message}`, "bad");
    }
  }, [logTrade]);

  const active = accounts[0];

  return (
    <div className="ba-terminal">
      <header className="topbar">
        <div className="brand">
          <div className="mark">BA</div>
          <div>
            <strong>IX Trading Terminal</strong>
            <span>{connected ? "MT5 Infinox Live" : "MT5 bridge offline"}</span>
          </div>
        </div>
        <nav className="tool-strip" aria-label="Platform tools">
          {["+", "X", "MA", "CP", "AL", "ST"].map((l, i) => (
            <button key={i} title={l} onClick={() => logTrade(`${l} tool ready`)}>{l}</button>
          ))}
        </nav>
        <div className="top-status">
          <span className={`connection-dot ${connected ? "online" : "offline"}`} />
          <span>{connText}</span>
          <span className="clock">{clock}</span>
        </div>
      </header>

      <section className="ticker-tape" aria-label="Market ticker">
        {symbols.slice(0, 8).map(sym => {
          const q = quotes.get(sym);
          const pct = q?.changePct ?? 0;
          const last = q ? fmt(q.last, q.digits) : "--";
          return (
            <div key={sym} onClick={() => setSelected(sym)}>
              <b>{sym}</b>
              <span className={pct >= 0 ? "up" : "down"}>
                {last} {pct >= 0 ? "+" : ""}{pct.toFixed(2)}%
              </span>
            </div>
          );
        })}
      </section>

      <main className="workspace">
        <aside className="left-stack">
          <section className="panel watchlist">
            <div className="panel-head">
              <h2>Watchlist</h2>
              <div className="mini-tools">
                <button onClick={() => logTrade("add symbol ready")}>+</button>
                <button onClick={() => logTrade("list toggled")}>List</button>
                <button onClick={() => logTrade("sort ready")}>v</button>
              </div>
            </div>
            <div className="table-head"><span>Asset</span><span>Chart</span><span>Last</span><span>%</span></div>
            <div className="watch-rows" ref={watchListRef}>
              {symbols.map(sym => {
                const q = quotes.get(sym);
                const pct = q?.changePct ?? 0;
                const last = q ? fmt(q.last, q.digits) : "--";
                return (
                  <button key={sym} className={`watch-row ${sym === selected ? "selected" : ""}`} onClick={() => setSelected(sym)}>
                    <b>{sym}</b>
                    <canvas className="spark" />
                    <span className={pct >= 0 ? "up" : "down"}>{last}</span>
                    <span className={pct >= 0 ? "up" : "down"}>{pct.toFixed(2)}%</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="panel market-view">
            <div className="panel-head">
              <h2>Market View</h2>
              <div className="mini-tools">
                <button onClick={() => logTrade("show all ready")}>All</button>
                <button onClick={() => logTrade("range 2D ready")}>2D</button>
              </div>
            </div>
            <div className="mini-grid" ref={miniRef}>
              {symbols.slice(0, 8).map(sym => {
                const q = quotes.get(sym);
                const pct = q?.changePct ?? 0;
                return (
                  <button key={sym} className="mini-card" onClick={() => setSelected(sym)}>
                    <div className="mini-title">
                      <span>{sym}</span>
                      <span className={pct >= 0 ? "up" : "down"}>{pct.toFixed(2)}%</span>
                    </div>
                    <canvas />
                  </button>
                );
              })}
            </div>
          </section>
        </aside>

        <section className="chart-panel">
          <div className="chart-head">
            <div>
              <b>{selected}</b>
              <span>15 Min</span>
              <span className={currentQuote.changePct >= 0 ? "up" : "down"}>
                {currentQuote.changePct >= 0 ? "+" : ""}{currentQuote.changePct.toFixed(2)}%
              </span>
            </div>
            <div className="ohlc">
              {candles.length ? (() => {
                const c = candles[candles.length - 1];
                return `O ${fmt(c.open, currentQuote.digits)} H ${fmt(c.high, currentQuote.digits)} L ${fmt(c.low, currentQuote.digits)} C ${fmt(c.close, currentQuote.digits)}`;
              })() : `Bid ${fmt(currentQuote.bid, currentQuote.digits)} Ask ${fmt(currentQuote.ask, currentQuote.digits)}`}
            </div>
          </div>
          <div className="chart-wrap">
            <canvas id="ba-mainChart" ref={chartRef} width={1100} height={720} />
            <div className="price-badge top">{fmt(currentQuote.ask, currentQuote.digits)}</div>
            <div className="price-badge mid">{fmt(currentQuote.bid, currentQuote.digits)}</div>
          </div>
          <div className="layout-tabs">
            {["1", "2", "3"].map(n => (
              <button key={n} className={layout === n ? "active" : ""} onClick={() => { setLayout(n); logTrade(`Layout ${n} loaded`); }}>Layout {n}</button>
            ))}
            <button onClick={() => logTrade("add layout ready")}>+</button>
          </div>
        </section>

        <aside className="right-rail">
          <section className="panel bidask">
            <div className="panel-head">
              <h2>Bid/Ask Board</h2>
              <div className="mini-tools">
                <button onClick={() => logTrade("popout ready")}>Pop</button>
                <button onClick={() => logTrade("maximize ready")}>Max</button>
                <button onClick={() => logTrade("hide ready")}>x</button>
              </div>
            </div>
            <div className="account-row">
              <label>Account</label>
              <select value={accountId} onChange={e => { setAccountId(e.target.value); logTrade("MT5 account selected"); }}>
                {accounts.length === 0 ? (
                  <option value="">MT5 account unavailable</option>
                ) : accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
              <button className="connect-button" onClick={bootstrap}>Reconnect</button>
            </div>
            <div className="order-grid">
              {symbols.slice(0, 6).map(sym => {
                const q = quotes.get(sym) || FALLBACK_QUOTES.find(f => f.symbol === sym) || FALLBACK_QUOTES[0];
                const bid = splitPrice(q.bid, q.digits);
                const ask = splitPrice(q.ask, q.digits);
                return (
                  <article key={sym} className="order-card">
                    <div className="order-top"><span>{sym}</span><span>CH ST x</span></div>
                    <div className="quote-line">
                      <button className="quote sell live" onClick={() => submitOrder("sell-market", sym, ticketQty, "bid-ask-board")}>
                        <label>Sell</label>
                        <strong><small>{bid.head}</small>{bid.tail}</strong>
                      </button>
                      <div className="qty-box">
                        <span>Qty<br />{fmt(q.spread, q.digits)}</span>
                        <input defaultValue={sym === "USATEC" ? "0.20" : "0.01"} />
                      </div>
                      <button className="quote buy live" onClick={() => submitOrder("buy-market", sym, ticketQty, "bid-ask-board")}>
                        <label>Buy</label>
                        <strong><small>{ask.head}</small>{ask.tail}</strong>
                      </button>
                    </div>
                    <div className="card-actions">
                      <button className="close" onClick={() => submitAction("close", sym)}>Close</button>
                      <button className="invert" onClick={() => submitAction("invert", sym)}>Invert</button>
                    </div>
                    <div className="bracket-line">
                      <span>Bracket</span>
                      <select><option value="none">None</option><option value="breakout">Breakout</option></select>
                      <button onClick={() => logTrade("settings ready")}>ST</button>
                    </div>
                  </article>
                );
              })}
            </div>
            <button className="add-tile" onClick={() => logTrade("add tile ready")}>+</button>
          </section>

          <section className="panel ticket">
            <div className="panel-head">
              <h2>Advanced Order Ticket</h2>
              <span className={`status ${connected ? "online" : ""}`}>{connected ? "Live MT5" : "Bridge Offline"}</span>
            </div>
            <div className="ticket-body">
              <label>Symbol
                <select value={selected} onChange={e => setSelected(e.target.value)}>
                  {symbols.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
              <label>Bracket
                <select value={bracket} onChange={e => setBracket(e.target.value)}>
                  <option value="none">&lt;None&gt;</option>
                  <option value="atr-breakout">ATR Breakout</option>
                  <option value="oco-scalper">OCO Scalper</option>
                </select>
              </label>
              <label>Price<input value={ticketPrice} onChange={e => setTicketPrice(e.target.value)} /></label>
              <label>Qty<input value={ticketQty} onChange={e => setTicketQty(e.target.value)} /></label>
              <div className="size-row">
                {["0.20", "0.40", "0.60"].map(s => (
                  <button key={s} onClick={() => setTicketQty(s)}>{s}</button>
                ))}
              </div>
              <div className="total-row"><span>Total</span><strong>{total}</strong></div>
              <div className="action-grid">
                <button className="buy-warn" onClick={() => submitOrder("buy-limit", selected, ticketQty, "advanced-ticket")}>Buy Limit</button>
                <button className="sell-green" onClick={() => submitOrder("sell-stop", selected, ticketQty, "advanced-ticket")}>Sell Stop</button>
                <button className="buy-warn" onClick={() => submitOrder("buy-market", selected, ticketQty, "advanced-ticket")}>Buy at Mkt</button>
                <button className="sell-green" onClick={() => submitOrder("sell-market", selected, ticketQty, "advanced-ticket")}>Sell at Mkt</button>
                <button className="neutral" onClick={() => submitAction("cancel", selected)}>Cancel Ord.</button>
                <button className="neutral" onClick={() => submitAction("invert", selected)}>Invert</button>
              </div>
              <button className="danger" onClick={() => submitAction("close", selected)}>Close</button>
              <button className="danger" onClick={() => submitAction("cancel-close", selected)}>Cancel Orders + Close</button>
              <div className="pnl">
                <div><span>Qty</span><b>{active?.raw?.account?.openPositionsCount ?? "-"}</b></div>
                <div><span>Open PnL</span><b>{money(active?.profit ?? 0)}</b></div>
                <div><span>Daily PnL</span><b>{money(active?.profit ?? 0)}</b></div>
                <div><span>Avg</span><b>{money(active?.balance ?? 0)}</b></div>
                <div><span>Total</span><b>{money(active?.equity ?? 0)}</b></div>
              </div>
              <div className="trade-log">
                {log.map((item, i) => (
                  <div key={i} className={item.tone}>
                    <span>{item.time}</span><b>{item.message}</b>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="panel variation">
            <div className="panel-head">
              <h2>Variation Analysis</h2>
              <span>{selected}</span>
            </div>
            <div>
              {[3, 2, .5, 0, -1, -2].map(step => {
                const value = currentQuote.last * (1 + step / 100);
                const className = step > 1 ? "green" : step > 0 ? "yellow" : step === 0 ? "base" : step > -2 ? "red soft" : "red";
                const label = step === 0 ? "Last" : `${step.toFixed(1)}%`;
                return (
                  <div key={step} className={`heat-row ${className}`}>
                    <span>{label}</span><b>{fmt(value, currentQuote.digits)}</b>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </main>
    </div>
  );
}
