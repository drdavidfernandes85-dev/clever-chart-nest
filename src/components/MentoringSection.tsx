import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GraduationCap, ArrowLeft, Send, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ScrollReveal from "@/components/ScrollReveal";

const MentoringSection = () => {
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    const { error } = await supabase
      .from("booking_requests")
      .insert({ email: email.trim().toLowerCase(), purpose: "mentoring_session" });
    setLoading(false);

    if (error) {
      toast.error("Something went wrong. Please try again.");
      return;
    }

    setSubmitted(true);
    toast.success("Request sent! We'll be in touch soon.");
  };

  return (
    <section id="education" className="bg-secondary/30 py-24">
      <div className="container">
        <ScrollReveal>
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <GraduationCap className="h-7 w-7 text-primary" />
            </div>

            {!showForm && !submitted && (
              <>
                <h2 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
                  One-on-One <span className="text-gradient">Mentoring</span>
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Get personalized coaching from our expert traders.
                </p>
                <Button
                  size="lg"
                  className="mt-8 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={() => setShowForm(true)}
                >
                  Book a Session
                </Button>
              </>
            )}

            {showForm && !submitted && (
              <div className="animate-fade-in-up">
                <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
                  Book an Appointment with Our <span className="text-gradient">Analyst</span>
                </h2>
                <p className="mx-auto mt-4 max-w-lg text-muted-foreground">
                  Leave your email and we'll get back to you to schedule your personalized mentoring session.
                </p>
                <form onSubmit={handleSubmit} className="mx-auto mt-8 flex max-w-md flex-col gap-3 sm:flex-row">
                  <Input
                    type="email"
                    required
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 border-border bg-secondary text-foreground placeholder:text-muted-foreground"
                  />
                  <Button
                    type="submit"
                    disabled={loading}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
                  >
                    {loading ? "Sending..." : <><Send className="h-4 w-4" /> Send</>}
                  </Button>
                </form>
                <button
                  onClick={() => setShowForm(false)}
                  className="mt-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
              </div>
            )}

            {submitted && (
              <div className="animate-fade-in-up">
                <CheckCircle className="mx-auto mb-4 h-12 w-12 text-primary" />
                <h2 className="font-heading text-2xl font-bold text-foreground md:text-3xl">
                  Request Received!
                </h2>
                <p className="mt-4 text-muted-foreground">
                  We'll contact you shortly to schedule your mentoring session.
                </p>
              </div>
            )}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default MentoringSection;
