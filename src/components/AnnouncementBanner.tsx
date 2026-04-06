import { Sparkles } from "lucide-react";

const AnnouncementBanner = () => (
  <div className="bg-primary py-4 text-center">
    <div className="container flex items-center justify-center gap-2">
      <Sparkles className="h-5 w-5 text-primary-foreground" />
      <p className="font-heading text-lg font-semibold text-primary-foreground">
        Something big is coming...
      </p>
      <a href="#" className="ml-1 font-medium text-primary-foreground underline underline-offset-4 hover:opacity-80">
        Click here to learn more
      </a>
    </div>
  </div>
);

export default AnnouncementBanner;
