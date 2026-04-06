import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";

const NewsletterSection = () => (
  <section className="py-24">
    <div className="container">
      <div className="card-glass mx-auto max-w-2xl rounded-2xl p-8 text-center md:p-12">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
          Subscribe to Our Weekly Newsletter
        </h2>
        <p className="mt-3 text-muted-foreground">
          Get the latest market insights and analysis delivered to your inbox.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Input
            type="email"
            placeholder="Enter your email"
            className="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground"
          />
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            Subscribe
          </Button>
        </div>
      </div>
    </div>
  </section>
);

export default NewsletterSection;
