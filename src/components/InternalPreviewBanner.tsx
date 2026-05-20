import { Info } from "lucide-react";

/**
 * Internal-preview marker shown on pages that are hidden from launch
 * navigation but still reachable via direct URL for testing.
 */
const InternalPreviewBanner = ({ label }: { label?: string }) => (
  <div className="mx-auto mb-4 flex max-w-5xl items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
    <Info className="h-3.5 w-3.5 shrink-0" />
    <span>
      <strong className="font-semibold">Internal preview</strong>
      {label ? ` · ${label}` : ""} — not visible in launch navigation.
    </span>
  </div>
);

export default InternalPreviewBanner;
