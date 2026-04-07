import { Sparkles } from "lucide-react";

const AnnouncementBanner = () => (
  <div className="bg-primary py-3 text-center">
    <div className="container flex items-center justify-center gap-2">
      <Sparkles className="h-4 w-4 text-primary-foreground" />
      <p className="font-heading text-sm font-semibold text-primary-foreground uppercase tracking-wide">
        Something big is coming...
      </p>
      <a href="#" className="ml-1 text-sm font-medium text-primary-foreground underline underline-offset-4 hover:opacity-80">
        Learn more
      </a>
    </div>
  </div>
);

export default AnnouncementBanner;
