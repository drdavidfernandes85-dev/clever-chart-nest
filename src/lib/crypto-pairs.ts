/**
 * Centralized crypto pair definitions for the entire app.
 * Mix of blue chips + trending meta plays (per user direction).
 *
 * - `symbol`         pretty label, e.g. "BTC/USDT"
 * - `base` / `quote` token tickers
 * - `tv`             TradingView symbol for charting widgets
 * - `coingecko`      CoinGecko id (used by free price feeds)
 * - `volume`         informational 24h notional (rough rank, just a label)
 */
export type CryptoPair = {
  symbol: string;
  base: string;
  quote: string;
  tv: string;
  coingecko: string;
  volume: string;
};

export const CRYPTO_PAIRS: CryptoPair[] = [
  { symbol: "BTC/USDT", base: "BTC", quote: "USDT", tv: "BINANCE:BTCUSDT", coingecko: "bitcoin",      volume: "32B" },
  { symbol: "ETH/USDT", base: "ETH", quote: "USDT", tv: "BINANCE:ETHUSDT", coingecko: "ethereum",     volume: "18B" },
  { symbol: "SOL/USDT", base: "SOL", quote: "USDT", tv: "BINANCE:SOLUSDT", coingecko: "solana",       volume: "4.2B" },
  { symbol: "SUI/USDT", base: "SUI", quote: "USDT", tv: "BINANCE:SUIUSDT", coingecko: "sui",          volume: "1.8B" },
  { symbol: "TON/USDT", base: "TON", quote: "USDT", tv: "BINANCE:TONUSDT", coingecko: "toncoin",      volume: "0.9B" },
  { symbol: "PEPE/USDT", base: "PEPE", quote: "USDT", tv: "BINANCE:PEPEUSDT", coingecko: "pepe",      volume: "1.4B" },
  { symbol: "WIF/USDT", base: "WIF", quote: "USDT", tv: "BINANCE:WIFUSDT", coingecko: "dogwifcoin",   volume: "0.6B" },
  { symbol: "HYPE/USDT", base: "HYPE", quote: "USDT", tv: "BINANCE:HYPEUSDT", coingecko: "hyperliquid", volume: "0.5B" },
];

/** Symbols available in chart selectors (TradingView format). */
export const CRYPTO_CHART_OPTIONS = CRYPTO_PAIRS.map((p) => ({
  label: p.symbol,
  value: p.tv,
}));

/** Look up a pair by its TradingView symbol. */
export const tvSymbolToPair = (tv: string): string => {
  const opt = CRYPTO_PAIRS.find((p) => p.tv === tv);
  return opt?.symbol ?? tv;
};

/** Default symbol for first chart load. */
export const DEFAULT_CRYPTO_TV = "BINANCE:BTCUSDT";
export const DEFAULT_CRYPTO_PAIR = "BTC/USDT";
