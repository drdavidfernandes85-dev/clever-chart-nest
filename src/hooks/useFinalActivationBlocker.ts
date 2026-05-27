import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FinalActivationBlocker {
  active: boolean;
  status: string | null;
  blockReasonCode: string | null;
  displayCopy: string | null;
  generalBuySellDisabled: boolean;
  clientLiveExecutionDisabled: boolean;
  pendingOrdersDisabled: boolean;
  permittedRetest: {
    symbol?: string;
    broker_symbol?: string;
    side?: string;
    volume?: number;
    route_account_id?: string;
    endpoint?: string;
    outbound_dto?: Record<string, unknown>;
  } | null;
  loading: boolean;
}

const initial: FinalActivationBlocker = {
  active: false,
  status: null,
  blockReasonCode: null,
  displayCopy: null,
  generalBuySellDisabled: false,
  clientLiveExecutionDisabled: false,
  pendingOrdersDisabled: false,
  permittedRetest: null,
  loading: true,
};

/**
 * Reads `site_settings.final_activation_blocker` and exposes its state.
 * Polls every 30s; trading components use it to gate BUY/SELL/pending buttons
 * and show the operator-facing display copy.
 */
export function useFinalActivationBlocker(): FinalActivationBlocker {
  const [state, setState] = useState<FinalActivationBlocker>(initial);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "final_activation_blocker")
          .maybeSingle();
        if (cancelled) return;
        const v: any = data?.value ?? null;
        if (!v || v.active !== true) {
          setState({ ...initial, loading: false });
          return;
        }
        setState({
          active: true,
          status: v.status ?? null,
          blockReasonCode: v.block_reason_code ?? null,
          displayCopy: v.display_copy ?? null,
          generalBuySellDisabled: v.general_buy_sell_disabled === true,
          clientLiveExecutionDisabled: v.client_live_execution_disabled === true,
          pendingOrdersDisabled: v.pending_orders_disabled === true,
          permittedRetest: v.permitted_retest ?? null,
          loading: false,
        });
      } catch {
        if (!cancelled) setState({ ...initial, loading: false });
      }
    };

    load();
    const id = window.setInterval(load, 30_000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  return state;
}
