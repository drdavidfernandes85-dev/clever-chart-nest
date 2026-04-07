import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const NewsletterSection = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase() });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast.info("You're already subscribed!");
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      return;
    }

    toast.success("Successfully subscribed!");
    setEmail("");
  };

  return (
    <section className="relative py-28">
      <div className="absolute inset-0 bg-radial-glow opacity-30" />
      <div className="container relative">
        <div className="card-glass mx-auto max-w-2xl rounded-3xl p-10 text-center md:p-14">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl tracking-tight">
            Subscribe to Our Weekly Newsletter
          </h2>
          <p className="mt-4 text-muted-foreground">
            Get the latest market insights and analysis delivered to your inbox.
          </p>
          <form onSubmit={handleSubscribe} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Input
              type="email"
              required
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground rounded-xl h-12"
            />
            <Button
              type="submit"
              disabled={loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-12 px-8 font-semibold shadow-lg shadow-primary/20"
            >
              {loading ? "Subscribing..." : "Subscribe"}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;
