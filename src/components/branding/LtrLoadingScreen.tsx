import LtrLogo from "./LtrLogo";

interface Props {
  label?: string;
}

/**
 * Full-screen premium loader used during route lazy-loads and the
 * initial terminal hydration. Deep void background with a pulsing
 * gold glow ring around the LTR mark.
 */
const LtrLoadingScreen = ({ label = "Loading LTR Terminal Pro" }: Props) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030303]">
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-[#FFCD05]/15 blur-2xl animate-pulse" />
        <div className="relative h-24 w-24 rounded-2xl border border-[#FFCD05]/40 bg-[#0B0B0C] p-2 shadow-[0_0_40px_rgba(255,205,5,0.35)]">
          <LtrLogo variant="icon" className="h-full w-full" glow={false} />
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="font-heading text-[11px] font-extrabold uppercase tracking-[0.32em] text-[#FFCD05]">
          {label}
        </span>
        <span className="text-[10px] uppercase tracking-[0.24em] text-[#8A8A8A]">
          Powered by Trading Layer
        </span>
      </div>
    </div>
  </div>
);

export default LtrLoadingScreen;
