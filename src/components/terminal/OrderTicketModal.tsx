/**
 * OrderTicketModal — modal variant of the docked order ticket.
 *
 * Reuses <OrderTicket /> as the single source of truth (same component, same
 * state shape, same submission paths). Adds a left-side live price sparkline
 * sourced from the SAME tick stream the rest of the terminal uses.
 *
 * Opened by:
 *   - the per-row "quick order" button in the watchlist (carries a symbol)
 *   - any future entry point dispatching `quickorder:open` with `detail.symbol`
 *
 * Row CLICK in the watchlist remains "select for chart" — the modal trigger is
 * a separate icon button (always visible on touch, hover-revealed on desktop).
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import OrderTicket from "@/components/terminal/OrderTicket";
import PriceSparkline from "@/components/terminal/PriceSparkline";

interface Props { oneClick: boolean }

export const QUICK_ORDER_EVENT = "quickorder:open";

export default function OrderTicketModal({ oneClick }: Props) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ symbol?: string }>).detail;
      setSymbol((detail?.symbol || "").toUpperCase() || null);
      setOpen(true);
    };
    window.addEventListener(QUICK_ORDER_EVENT, onOpen as EventListener);
    return () => window.removeEventListener(QUICK_ORDER_EVENT, onOpen as EventListener);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl bg-[#0a0a0b] border-neutral-800 text-neutral-100 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-3 pb-2 border-b border-neutral-800">
          <DialogTitle className="font-mono text-[#FFCD05] text-sm">
            Orden rápida {symbol ? `· ${symbol}` : ""}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] min-h-[520px]">
          <div className="p-3 border-r border-neutral-800 bg-[#0e0e10] flex flex-col gap-2">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Últimos ticks</div>
            {symbol ? (
              <PriceSparkline symbol={symbol} />
            ) : (
              <div className="text-[10px] text-neutral-600">Selecciona un símbolo</div>
            )}
            <div className="mt-auto text-[9px] font-mono uppercase tracking-[0.18em] text-neutral-600">
              Live · Trading Layer
            </div>
          </div>
          <div className="min-h-[520px]">
            <OrderTicket
              oneClick={oneClick}
              overrideSymbol={symbol || undefined}
              onOrderPlaced={() => setOpen(false)}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
