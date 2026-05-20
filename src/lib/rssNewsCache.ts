/**
 * Shared RSS news cache for the News & Calendar page.
 *
 * Both NewsFlow and LiveSquawk used to invoke the same `fetch-rss-news`
 * edge function every 60s independently — doubling traffic. This module
 * dedupes them: a single timer fetches at most once every REFRESH_MS,
 * and all subscribers receive the same payload.
 *
 * Polling only runs while at least one subscriber is active; the timer
 * stops automatically when the News page unmounts.
 */
import { supabase } from "@/integrations/supabase/client";

export interface RssNewsItem {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  category: string;
  description?: string;
}

type State = {
  items: RssNewsItem[];
  loading: boolean;
  error: string | null;
  lastFetched: number;
};

const REFRESH_MS = 120_000; // News refreshes every 2 min — RSS doesn't move faster than that
const FETCH_TIMEOUT_MS = 10_000;

let state: State = { items: [], loading: false, error: null, lastFetched: 0 };
const listeners = new Set<(s: State) => void>();
let inflight: Promise<void> | null = null;
let timer: number | null = null;

function emit() {
  listeners.forEach((l) => l(state));
}

async function doFetch(): Promise<void> {
  if (inflight) return inflight;
  state = { ...state, loading: true };
  emit();
  inflight = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-rss-news");
        window.clearTimeout(timeoutId);
        if (error) throw error;
        const items = (data?.data as RssNewsItem[]) ?? [];
        state = { items, loading: false, error: null, lastFetched: Date.now() };
      } catch (e: any) {
        window.clearTimeout(timeoutId);
        state = {
          ...state,
          loading: false,
          error: e?.name === "AbortError" ? "News feed timed out. Please retry." : (e?.message || "Failed to load news."),
        };
      }
    } finally {
      inflight = null;
      emit();
    }
  })();
  return inflight;
}

function startTimer() {
  if (timer != null) return;
  timer = window.setInterval(() => {
    void doFetch();
  }, REFRESH_MS);
}

function stopTimer() {
  if (timer != null) {
    window.clearInterval(timer);
    timer = null;
  }
}

export function subscribeRssNews(listener: (s: State) => void): () => void {
  listeners.add(listener);
  listener(state);
  // First subscriber kicks off fetch + polling. Subsequent ones reuse cache.
  if (listeners.size === 1) {
    startTimer();
    if (Date.now() - state.lastFetched > REFRESH_MS / 2) void doFetch();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) stopTimer();
  };
}

export function refreshRssNews(): Promise<void> {
  return doFetch();
}
