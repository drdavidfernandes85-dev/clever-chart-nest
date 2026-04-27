import { useState } from "react";
import { PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import LeadCaptureForm from "./LeadCaptureForm";

interface Props {
  source: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}

const FreeWebinarModal = ({ source, trigger, open, onOpenChange }: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md overflow-hidden border-primary/20 bg-background/95 p-0 backdrop-blur-2xl">
        <div className="relative">
          {/* Glow */}
          <div className="pointer-events-none absolute inset-x-0 -top-20 h-40 bg-gradient-to-b from-primary/30 via-primary/10 to-transparent blur-2xl" />
          <div className="relative px-6 pt-6 pb-5">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
              <Sparkles className="h-3 w-3" /> Free Access
            </div>
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="font-heading text-2xl font-bold leading-tight">
                Watch our next <span className="text-primary">Free Live Webinar</span>
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                Get instant access to upcoming live sessions and our full educational replay library.
              </DialogDescription>
            </DialogHeader>

            <ul className="my-4 space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <PlayCircle className="h-3.5 w-3.5 text-primary" /> Daily live mentor sessions
              </li>
              <li className="flex items-center gap-2">
                <PlayCircle className="h-3.5 w-3.5 text-primary" /> Replay library: 50+ educational videos
              </li>
              <li className="flex items-center gap-2">
                <PlayCircle className="h-3.5 w-3.5 text-primary" /> Market breakdowns &amp; community ideas
              </li>
            </ul>

            <LeadCaptureForm
              source={source}
              ctaLabel="Send Me Free Access"
              onSuccess={() => setTimeout(() => setOpen(false), 1800)}
            />

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-3 block w-full text-center text-[11px] text-muted-foreground/80 hover:text-foreground"
            >
              No thanks
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FreeWebinarModal;

// Convenient default trigger button — yellow CTA
export const FreeWebinarTrigger = ({
  source,
  className,
  label = "Watch Free Live Webinar",
}: {
  source: string;
  className?: string;
  label?: string;
}) => (
  <FreeWebinarModal
    source={source}
    trigger={
      <Button
        size="lg"
        className={
          className ??
          "h-12 gap-2 rounded-full bg-[#FFCD05] px-6 font-bold text-black hover:bg-[#FFE066] shadow-[0_0_25px_hsl(45_100%_50%/0.45)]"
        }
      >
        <PlayCircle className="h-4 w-4" />
        {label}
      </Button>
    }
  />
);
