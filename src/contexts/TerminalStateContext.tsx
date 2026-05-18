/**
 * TerminalStateContext
 * --------------------
 * A single, stable state layer for the trading terminal.
 *
 * Contract (stale-while-revalidate):
 *   1. Only replace `*Data` if the incoming response is *valid*.
 *   2. If the incoming response is invalid (null/undefined/empty/missing fields),
 *      keep the previous `lastGood*` value visible.
 *   3. `selectedSymbol` is never reset by polling. It changes only when the user
 *      explicitly picks a new symbol.
 *   4. Bid/Ask Board and Order Ticket data are never set to null during refresh.
 *   5. `accountData` is never cleared during refresh — only on real logout.
 *   6. Errors surface via `lastError` + `staleData`; they never blank the UI.
 *
 * This layer derives from the existing data contexts (which already implement
 * SWR at the network boundary) and exposes a stable, validated snapshot.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLiveAccount, type LiveAccount, type LivePosition } from "./LiveAccountContext";
import { useBrokerSymbols, type BrokerSymbol } from "./BrokerSymbolsContext";
import { useMultiSymbolTicks, type MultiTick } from "@/hooks/useMultiSymbolTicks";

// ---------- Validators ----------

const isValidAccount = (a: LiveAccount | null | undefined): a is LiveAccount =>
  !!a && (a.login !== "" || a.balance != null || a.equity != null);

const isValidMarketWatch = (xs: BrokerSymbol[] | null | undefined): xs is BrokerSymbol[] =>
  Array.isArray(xs) && xs.length > 0;

const isValidBidAsk = (
  m: Record<string, MultiTick> | null | undefined,
): m is Record<string, MultiTick> => !!m && Object.keys(m).length > 0;

const isValidSymbolTick = (t: any): boolean =>
  !!t && (t.bid != null || t.ask != null || t.last != null);

const isValidPositions = (xs: LivePosition[] | null | undefined): xs is LivePosition[] =>
  Array.isArray(xs); // empty array IS valid (= no open positions)

// ---------- Public shape ----------

export interface TerminalState {
  // Live snapshots
  accountData: LiveAccount | null;
  lastGoodAccountData: LiveAccount | null;

  marketWatchData: BrokerSymbol[];
  lastGoodMarketWatchData: BrokerSymbol[];

  bidAskBoardData: Record<string, MultiTick>;
  lastGoodBidAskBoardData: Record<string, MultiTick>;

  selectedSymbol: string;
  lastGoodSelectedSymbol: string;

  selectedSymbolData: any | null;
  lastGoodSelectedSymbolData: any | null;

  positions: LivePosition[];
  lastGoodPositions: LivePosition[];

  // Lifecycle flags
  refreshing: boolean;
  initialLoading: boolean;
  staleData: boolean;
  lastError: string | null;
  lastUpdatedAt: number | null;

  // Actions
  setSelectedSymbol: (symbol: string) => void;
  refresh: () => Promise<void>;

  /** Subscribe additional symbols to the Bid/Ask Board feed. */
  setBidAskSymbols: (symbols: string[]) => void;
}

const Ctx = createContext<TerminalState | null>(null);

// ---------- Helper: lastGood mirror ----------

function useLastGood<T>(value: T, isValid: (v: T) => boolean, initial: T): T {
  const ref = useRef<T>(isValid(value) ? value : initial);
  if (isValid(value)) ref.current = value;
  return ref.current;
}

// ---------- Provider ----------

export function TerminalStateProvider({ children }: { children: ReactNode }) {
  const {
    liveAccount,
    positions,
    loading: accountLoading,
    refreshing: accountRefreshing,
    error: accountError,
    refresh: refreshAccount,
  } = useLiveAccount();

  const {
    symbols,
    loading: symbolsLoading,
    error: symbolsError,
    selectedBrokerSymbol,
    setSelectedBrokerSymbol,
    tick: selectedTick,
    selectedSymbolInfo,
    selectedSymbolValid,
    refresh: refreshSymbols,
  } = useBrokerSymbols();

  // Symbols subscribed to the Bid/Ask Board ticker feed.
  // Default to whatever the consumer registers via setBidAskSymbols.
  const [bidAskSymbols, setBidAskSymbols] = useState<string[]>([]);
  const bidAskRows = useMultiSymbolTicks(bidAskSymbols);

  // ----- Validated live values -----
  const accountData = isValidAccount(liveAccount) ? liveAccount : null;
  const marketWatchData = isValidMarketWatch(symbols) ? symbols : [];
  const bidAskBoardData = isValidBidAsk(bidAskRows) ? bidAskRows : {};
  const positionsData = isValidPositions(positions) ? positions : [];

  // selectedSymbolData = combined snapshot for the Order Ticket / chart.
  const selectedSymbolData = useMemo(() => {
    if (!isValidSymbolTick(selectedTick) && !selectedSymbolInfo) return null;
    return {
      symbol: selectedBrokerSymbol,
      tick: selectedTick ?? null,
      info: selectedSymbolInfo ?? null,
      valid: selectedSymbolValid,
    };
  }, [selectedBrokerSymbol, selectedTick, selectedSymbolInfo, selectedSymbolValid]);

  // ----- Last-good mirrors -----
  const lastGoodAccountData = useLastGood(accountData, isValidAccount, null);
  const lastGoodMarketWatchData = useLastGood(
    marketWatchData,
    isValidMarketWatch,
    [],
  );
  const lastGoodBidAskBoardData = useLastGood(bidAskBoardData, isValidBidAsk, {});
  const lastGoodPositions = useLastGood(positionsData, isValidPositions, []);
  const lastGoodSelectedSymbol = useLastGood(
    selectedBrokerSymbol,
    (s) => !!s && s.length > 0,
    "",
  );
  const lastGoodSelectedSymbolData = useLastGood(
    selectedSymbolData,
    (v): v is NonNullable<typeof v> => !!v && isValidSymbolTick(v.tick),
    null,
  );

  // ----- Lifecycle flags -----
  const [initialLoading, setInitialLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  // Refreshing = any underlying source is in-flight.
  const refreshing = accountRefreshing || symbolsLoading;

  // Stale = we are showing lastGood while the latest live value is invalid.
  const staleData =
    (!isValidAccount(liveAccount) && !!lastGoodAccountData) ||
    (!isValidMarketWatch(symbols) && lastGoodMarketWatchData.length > 0) ||
    (!isValidBidAsk(bidAskRows) && Object.keys(lastGoodBidAskBoardData).length > 0) ||
    (!isValidSymbolTick(selectedTick) && !!lastGoodSelectedSymbolData);

  const lastError = accountError || symbolsError || null;

  // Mark initial-load complete once we have *any* good snapshot.
  useEffect(() => {
    if (
      initialLoading &&
      (lastGoodAccountData || lastGoodMarketWatchData.length > 0)
    ) {
      setInitialLoading(false);
    }
  }, [initialLoading, lastGoodAccountData, lastGoodMarketWatchData]);

  // Bump lastUpdatedAt whenever any live value transitions to valid.
  useEffect(() => {
    if (
      isValidAccount(liveAccount) ||
      isValidSymbolTick(selectedTick) ||
      isValidBidAsk(bidAskRows)
    ) {
      setLastUpdatedAt(Date.now());
    }
  }, [liveAccount, selectedTick, bidAskRows]);

  // ----- Actions -----
  const setSelectedSymbol = useCallback(
    (symbol: string) => {
      // Rule 5: never reset selectedSymbol from inside polling.
      // Only the explicit user action goes through here.
      if (!symbol) return;
      setSelectedBrokerSymbol(symbol);
    },
    [setSelectedBrokerSymbol],
  );

  const refresh = useCallback(async () => {
    await Promise.all([refreshAccount(), refreshSymbols(undefined, { force: true })]);
  }, [refreshAccount, refreshSymbols]);

  const value = useMemo<TerminalState>(
    () => ({
      // Live
      accountData,
      lastGoodAccountData,
      marketWatchData,
      lastGoodMarketWatchData,
      bidAskBoardData,
      lastGoodBidAskBoardData,
      selectedSymbol: selectedBrokerSymbol,
      lastGoodSelectedSymbol,
      selectedSymbolData,
      lastGoodSelectedSymbolData,
      positions: positionsData,
      lastGoodPositions,
      // Flags
      refreshing,
      initialLoading,
      staleData,
      lastError,
      lastUpdatedAt,
      // Actions
      setSelectedSymbol,
      refresh,
      setBidAskSymbols,
    }),
    [
      accountData,
      lastGoodAccountData,
      marketWatchData,
      lastGoodMarketWatchData,
      bidAskBoardData,
      lastGoodBidAskBoardData,
      selectedBrokerSymbol,
      lastGoodSelectedSymbol,
      selectedSymbolData,
      lastGoodSelectedSymbolData,
      positionsData,
      lastGoodPositions,
      refreshing,
      initialLoading,
      staleData,
      lastError,
      lastUpdatedAt,
      setSelectedSymbol,
      refresh,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTerminalState(): TerminalState {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useTerminalState must be used inside <TerminalStateProvider>",
    );
  }
  return ctx;
}

/**
 * Convenience hook: returns the value to render — always prefers live data,
 * falls back to lastGood when live is invalid. Components should use this
 * everywhere they would otherwise pass nullable data into the UI.
 */
export function useStableTerminalView() {
  const s = useTerminalState();
  return {
    account: s.accountData ?? s.lastGoodAccountData,
    marketWatch: s.marketWatchData.length > 0 ? s.marketWatchData : s.lastGoodMarketWatchData,
    bidAsk:
      Object.keys(s.bidAskBoardData).length > 0
        ? s.bidAskBoardData
        : s.lastGoodBidAskBoardData,
    selectedSymbol: s.selectedSymbol || s.lastGoodSelectedSymbol,
    selectedSymbolData: s.selectedSymbolData ?? s.lastGoodSelectedSymbolData,
    positions: s.positions.length > 0 ? s.positions : s.lastGoodPositions,
    refreshing: s.refreshing,
    initialLoading: s.initialLoading,
    staleData: s.staleData,
    lastError: s.lastError,
    lastUpdatedAt: s.lastUpdatedAt,
  };
}
