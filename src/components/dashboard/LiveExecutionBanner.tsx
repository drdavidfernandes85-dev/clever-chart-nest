import { AlertTriangle } from "lucide-react";

/**
 * Permanent banner reminding the user that the terminal is wired to a real
 * MT5 account. Rendered above execution panels.
 */
const LiveExecutionBanner = () => (
  <div
    role="alert"
    className="flex items-start gap-2 rounded-md border border-[#FFCD05]/40 bg-[#FFCD05]/5 px-3 py-2 text-[11px] text-[#FFCD05]"
  >
    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
    <div className="leading-snug">
      <strong className="font-semibold">Live execution</strong> is connected to
      your MT5 account. Orders and closes are real.
      <span className="ml-2 rounded border border-[#FFCD05]/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#FFCD05]">
        Test Mode · max 0.01 lots
      </span>
    </div>
  </div>
);

export default LiveExecutionBanner;
